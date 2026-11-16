import test from 'node:test';
import assert from 'node:assert/strict';
import {validateValues,generateSimulatedValues,loadMeasurements,saveMeasurements} from '../Interfaz/measurement-store.js';
import {metrics,manualMetrics,classify} from '../Interfaz/report-data.js';
import {consecutiveShortSleepDays,fetchDatabaseMeasurements} from '../Interfaz/report-source.js';

// This in-memory PostgREST boundary is test-only. Runtime code never falls back here.
function database(options = {}) {
  const rows = options.rows ?? [];
  const calls = [];
  const userId = options.userId ?? 'user-a';
  let serial = rows.length;
  const client = {
    auth:{getUser:async () => {
      if (options.authThrows) throw new Error('Offline');
      return options.authError ? {data:null,error:{message:'Expired'}} : {data:{user:options.anonymous ? null : {id:userId}},error:null};
    }},
    from(table) {
      calls.push(['from',table]);
      let owner,inserted;
      const query = {
        select(columns) { calls.push(['select',columns]); return query; },
        eq(key,value) { calls.push(['eq',key,value]); owner=value; return query; },
        not(key,operator,value) { calls.push(['not',key,operator,value]); return query; },
        order(key,settings) { calls.push(['order',key,settings]); return query; },
        limit(value) { calls.push(['limit',value]); return query; },
        insert(value) { calls.push(['insert',value]); inserted=value; return query; },
        async maybeSingle() {
          if (options.readThrows) throw new Error('Offline');
          if (options.readError) return {data:null,error:options.readError};
          if (options.badRow) return {data:options.badRow,error:null};
          const matching=rows.filter(row=>row.user_id===owner&&row.manual_measurements!==null&&row.manual_measurements!==undefined).sort((a,b)=>b.ts.localeCompare(a.ts)||b.id-a.id);
          return {data:matching[0] ?? null,error:null};
        },
        async single() {
          if (options.writeThrows) throw new Error('Offline');
          if (options.writeError) return {data:null,error:options.writeError};
          if (options.badRow) return {data:options.badRow,error:null};
          const row={id:++serial,...structuredClone(inserted),ts:`2026-11-15T00:00:${String(serial).padStart(2,'0')}.000Z`};
          rows.push(row);return {data:row,error:null};
        },
      };return query;
    },
  };
  return {client,rows,calls};
}

test('all seven manual metrics round-trip as normalized values',async()=>{
  const {client,rows}=database();
  const values={pvt:'250',tlx:'60',amsler:'yellow',perfusion:'1.5',medication:{takenPercent:'95',doubleDose:'no'},orthostatic:{hrRise:'15',systolicDrop:'5',diastolicDrop:'0',symptoms:'none'},who5:'64'};
  const saved=await saveMeasurements(client,'user-a',values);
  assert.deepEqual(saved.values,{pvt:250,tlx:60,amsler:'yellow',perfusion:1.5,medication:{takenPercent:95,doubleDose:'no'},orthostatic:{hrRise:15,systolicDrop:5,diastolicDrop:0,symptoms:'none'},who5:64});
  assert.deepEqual(await loadMeasurements(client,'user-a'),saved);
  assert.deepEqual(Object.keys(rows[0]).sort(),['asleep','automatic_data','co2','gravity','hr','id','is_simulated','latency_s','manual_measurements','mission_day','phase','rad_rate','resp','rr','simulated_data','spo2','temp','ts','user_id']);
  assert.deepEqual(rows[0].manual_measurements,saved.values);
  assert.equal(rows[0].is_simulated,true);
  assert.deepEqual(rows[0].automatic_data,{hr:rows[0].hr,rr:rows[0].rr,temp:rows[0].temp,spo2:rows[0].spo2,resp:rows[0].resp,rad_rate:rows[0].rad_rate,co2:rows[0].co2,asleep:false,phase:'prototipo',gravity:0.38,latency_s:rows[0].latency_s,mission_day:1});
  assert.deepEqual(Object.keys(rows[0].simulated_data).sort(),metrics.filter(metric=>!manualMetrics.some(manual=>manual.id===metric.id)).map(metric=>metric.id).sort());
  assert.equal(rows[0].simulated_data.heartRate,rows[0].hr);
});

test('empty snapshots supersede previous readings; missing and skipped fields stay absent',async()=>{
  const {client,rows}=database();assert.equal(await loadMeasurements(client,'user-a'),null);
  await saveMeasurements(client,'user-a',{pvt:600,amsler:'red'});
  const empty=await saveMeasurements(client,'user-a',{});
  assert.deepEqual((await loadMeasurements(client,'user-a')).values,{});
  assert.equal((await loadMeasurements(client,'user-a')).id,empty.id);
  assert.deepEqual(Object.keys(rows[1].simulated_data).sort(),metrics.map(metric=>metric.id).sort());
  assert.deepEqual(validateValues({pvt:'',amsler:null,medication:{takenPercent:'',doubleDose:''}}),{});
});

test('simulated manual fields fill only unanswered values',async()=>{
  const {client,rows}=database();
  await saveMeasurements(client,'user-a',{tlx:50,medication:{takenPercent:90},orthostatic:{hrRise:0}});
  const simulated=rows[0].simulated_data;
  assert.equal(simulated.tlx,undefined);
  assert.deepEqual(simulated.medication,{doubleDose:'no'});
  assert.equal(simulated.orthostatic.hrRise,undefined);
  assert.equal(typeof simulated.orthostatic.systolicDrop,'number');
});

test('generated simulation covers every metric with a valid display value',()=>{
  const values=generateSimulatedValues({hr:72,co2:800,gravity:0.38,spo2:98,resp:16,temp:36.7});
  assert.deepEqual(Object.keys(values).sort(),metrics.map(metric=>metric.id).sort());
  for(const metric of metrics)assert(!['invalid','missing'].includes(classify(metric,values[metric.id],values)),metric.id);
});

test('short-sleep alert uses a consecutive run of daily records',()=>{
  const sleep = metrics.find(metric => metric.id === 'sleep');
  const records = [
    {date:'2026-11-15',sleep:5.5},
    {date:'2026-11-14',sleep:5.8},
    {date:'2026-11-13',sleep:5.9},
  ];
  assert.equal(consecutiveShortSleepDays(records),3);
  assert.equal(classify(sleep,5.5,{sleepDays:consecutiveShortSleepDays(records)}),'red');
  assert.equal(consecutiveShortSleepDays(records.slice(0,2)),2);
  assert.equal(classify(sleep,5.5,{sleepDays:2}),'unknown');
  assert.equal(consecutiveShortSleepDays([records[0],{date:'2026-11-12',sleep:5.8}]),1);
  assert.equal(consecutiveShortSleepDays([{date:'2026-11-15',sleep:7},...records]),0);
});

test('database report derives sleep streak from the daily record history',async()=>{
  const rows = [
    {date:'2026-11-15',sleep:5.5},
    {date:'2026-11-14',sleep:5.8},
    {date:'2026-11-13',sleep:5.9},
  ];
  const sensors = [
    {date:'2026-11-15',rad_msv:0.2},
    {date:'2026-11-14',rad_msv:0.3},
    {date:'2026-11-13',rad_msv:0.4},
  ];
  const client = {
    rpc() { return Promise.resolve({data:'2026-11-14T00:00:00.000Z',error:null}); },
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        order() { return query; },
        not() { return query; },
        limit() { return query; },
        range() { return Promise.resolve({data:table === 'records' ? rows : table === 'daily_sensor' ? sensors : [],error:null}); },
        maybeSingle() { return Promise.resolve({data:null,error:null}); },
      };
      return query;
    },
  };
  const result = await fetchDatabaseMeasurements(client,'user-a');
  const sleep = metrics.find(metric => metric.id === 'sleep');
  assert.equal(result.values.sleep,5.5);
  assert.equal(result.values.sleepDays,3);
  assert.equal(classify(sleep,result.values.sleep,result.values),'red');
  assert.equal(result.values.dose,0.5);
  assert.equal(result.dates.dose,'2026-11-14 – 2026-11-15');

  client.rpc = () => Promise.resolve({data:null,error:null});
  const withoutMissionStart = await fetchDatabaseMeasurements(client,'user-a');
  assert.equal(withoutMissionStart.values.dose,undefined);
  assert(withoutMissionStart.warnings.some(warning => warning.includes('mission start date')));
});

test('automatic-only telemetry rows are not treated as Captura snapshots',async()=>{
  const {client}=database({rows:[{id:1,user_id:'user-a',manual_measurements:null,ts:'2026-11-15T01:00:00Z'}]});
  assert.equal(await loadMeasurements(client,'user-a'),null);
});

test('valid partial questionnaires are retained but every supplied field is validated',()=>{
  assert.deepEqual(validateValues({medication:{takenPercent:'80'},orthostatic:{symptoms:'dizzy'}}),{medication:{takenPercent:80},orthostatic:{symptoms:'dizzy'}});
  for(const values of [
    {medication:{takenPercent:'101'}},{medication:{takenPercent:'90.5'}},{medication:{doubleDose:'maybe'}},
    {orthostatic:{hrRise:'-1'}},{orthostatic:{systolicDrop:'1.5'}},{orthostatic:{symptoms:'invalid'}},
    {medication:{extra:1}},{orthostatic:[]},
  ])assert.throws(()=>validateValues(values));
});

test('invalid types, values, fractions, oversized strings and unknown measurements are rejected',()=>{
  for(const values of [null,[],new Date(),{sleep:8},{pvt:true},{pvt:{}},{pvt:' '},{pvt:'x'.repeat(20000)},{pvt:Infinity},{pvt:NaN},{pvt:-1},{pvt:1.5},{tlx:101},{who5:-1},{who5:50.5},{perfusion:.15},{amsler:'blue'},JSON.parse('{"__proto__":{}}')])assert.throws(()=>validateValues(values));
  assert.deepEqual(validateValues({tlx:0,perfusion:.3}),{tlx:0,perfusion:.3});
});

test('signed-in identity must match the requested account before reads or writes',async()=>{
  const {client,calls}=database();
  await assert.rejects(loadMeasurements(client,'user-b'),/session changed/);
  await assert.rejects(saveMeasurements(client,'user-b',{pvt:250}),/session changed/);
  assert.equal(calls.length,0);
  await assert.rejects(saveMeasurements(client,null,{}),/Sign in/);
  await assert.rejects(loadMeasurements(database({anonymous:true}).client,'user-a'),/Sign in/);
  await assert.rejects(loadMeasurements(null,'user-a'),/connection/);
});

test('queries filter snapshots by account and reject mismatched returned owners',async()=>{
  const {client,calls}=database({rows:[{id:1,user_id:'user-b',manual_measurements:{pvt:600},ts:'2026-11-15T01:00:00Z'}]});
  assert.equal(await loadMeasurements(client,'user-a'),null);
  assert(calls.some(([method,table])=>method==='from'&&table==='telemetry'));
  assert(calls.some(([method,key,value])=>method==='eq'&&key==='user_id'&&value==='user-a'));
  assert(calls.some(([method,key,operator,value])=>method==='not'&&key==='manual_measurements'&&operator==='is'&&value===null));
  const wrong={id:2,user_id:'user-b',manual_measurements:{pvt:600},ts:'2026-11-15T00:00:00Z'};
  await assert.rejects(loadMeasurements(database({badRow:wrong}).client,'user-a'),/invalid/);
  await assert.rejects(saveMeasurements(database({badRow:wrong}).client,'user-a',{}),/invalid/);
});

test('database and network errors are surfaced; missing tables have an actionable error',async()=>{
  await assert.rejects(loadMeasurements(database({readThrows:true}).client,'user-a'),/Could not load/);
  await assert.rejects(loadMeasurements(database({readError:{code:'42501'}}).client,'user-a'),/denied the save/);
  await assert.rejects(saveMeasurements(database({writeThrows:true}).client,'user-a',{}),/Could not save/);
  await assert.rejects(saveMeasurements(database({writeError:{code:'42501'}}).client,'user-a',{}),/denied the save/);
  await assert.rejects(saveMeasurements(database({writeError:{code:'23503'}}).client,'user-a',{}),/associated profile/);
  for(const code of ['42P01','42703','PGRST204','PGRST205'])await assert.rejects(loadMeasurements(database({readError:{code}}).client,'user-a'),/unified telemetry migration/);
  await assert.rejects(loadMeasurements(database({authThrows:true}).client,'user-a'),/session/);
  await assert.rejects(saveMeasurements(database({authError:true}).client,'user-a',{}),/session/);
});

test('malformed stored data is rejected, and invalid input never issues an insert',async()=>{
  const {client,calls}=database();await assert.rejects(saveMeasurements(client,'user-a',{tlx:101}));assert(!calls.some(([name])=>name==='insert'));
  for(const row of [
    {id:'bad',user_id:'user-a',manual_measurements:{tlx:101},ts:'2026-11-15T00:00:00Z'},
    {id:'bad',user_id:'user-a',manual_measurements:{pvt:250},ts:'invalid'},
    {id:'bad',user_id:'user-a',manual_measurements:null,ts:'2026-11-15T00:00:00Z'},
  ])await assert.rejects(loadMeasurements(database({badRow:row}).client,'user-a'));
});

test('mission report reads use the selected member while writes remain self-only',async()=>{
  const row={id:1,user_id:'user-b',manual_measurements:{pvt:300},ts:'2026-11-15T01:00:00Z'};
  const {client}=database({rows:[row]});
  const result=await loadMeasurements(client,'user-b',{missionRead:true});
  assert.equal(result.values.pvt,300);
  await assert.rejects(saveMeasurements(client,'user-b',{}));
  await assert.rejects(loadMeasurements(database({readError:{code:'42501'}}).client,'user-b',{missionRead:true}));
});
