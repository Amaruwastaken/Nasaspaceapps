import test from 'node:test';
import assert from 'node:assert/strict';
import {validateValues,loadMeasurements,saveMeasurements} from '../Interfaz/measurement-store.js';

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
        order(key,settings) { calls.push(['order',key,settings]); return query; },
        limit(value) { calls.push(['limit',value]); return query; },
        insert(value) { calls.push(['insert',value]); inserted=value; return query; },
        async maybeSingle() {
          if (options.readThrows) throw new Error('Offline');
          if (options.readError) return {data:null,error:options.readError};
          if (options.badRow) return {data:options.badRow,error:null};
          const matching=rows.filter(row=>row.user_id===owner).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
          return {data:matching[0] ?? null,error:null};
        },
        async single() {
          if (options.writeThrows) throw new Error('Offline');
          if (options.writeError) return {data:null,error:options.writeError};
          if (options.badRow) return {data:options.badRow,error:null};
          const row={id:String(++serial).padStart(5,'0'),...structuredClone(inserted),created_at:`2026-11-15T00:00:${String(serial).padStart(2,'0')}.000Z`};
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
  assert.deepEqual(Object.keys(rows[0]).sort(),['created_at','id','measurements','user_id']);
});

test('empty snapshots supersede previous readings; missing and skipped fields stay absent',async()=>{
  const {client}=database();assert.equal(await loadMeasurements(client,'user-a'),null);
  await saveMeasurements(client,'user-a',{pvt:600,amsler:'red'});
  const empty=await saveMeasurements(client,'user-a',{});
  assert.deepEqual((await loadMeasurements(client,'user-a')).values,{});
  assert.equal((await loadMeasurements(client,'user-a')).id,empty.id);
  assert.deepEqual(validateValues({pvt:'',amsler:null,medication:{takenPercent:'',doubleDose:''}}),{});
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
  await assert.rejects(loadMeasurements(client,'user-b'),/sesión cambió/);
  await assert.rejects(saveMeasurements(client,'user-b',{pvt:250}),/sesión cambió/);
  assert.equal(calls.length,0);
  await assert.rejects(saveMeasurements(client,null,{}),/Inicia sesión/);
  await assert.rejects(loadMeasurements(database({anonymous:true}).client,'user-a'),/Inicia sesión/);
  await assert.rejects(loadMeasurements(null,'user-a'),/conexión/);
});

test('queries filter snapshots by account and reject mismatched returned owners',async()=>{
  const {client,calls}=database({rows:[{id:'other',user_id:'user-b',measurements:{pvt:600},created_at:'2026-11-15T01:00:00Z'}]});
  assert.equal(await loadMeasurements(client,'user-a'),null);
  assert(calls.some(([method,key,value])=>method==='eq'&&key==='user_id'&&value==='user-a'));
  const wrong={id:'bad',user_id:'user-b',measurements:{pvt:600},created_at:'2026-11-15T00:00:00Z'};
  await assert.rejects(loadMeasurements(database({badRow:wrong}).client,'user-a'),/inválida/);
  await assert.rejects(saveMeasurements(database({badRow:wrong}).client,'user-a',{}),/inválida/);
});

test('database and network errors are surfaced; missing tables have an actionable error',async()=>{
  for(const options of [{readThrows:true},{readError:{code:'42501'}}])await assert.rejects(loadMeasurements(database(options).client,'user-a'),/consultar/);
  for(const options of [{writeThrows:true},{writeError:{code:'42501'}}])await assert.rejects(saveMeasurements(database(options).client,'user-a',{}),/guardar/);
  for(const code of ['42P01','PGRST205'])await assert.rejects(loadMeasurements(database({readError:{code}}).client,'user-a'),/manual_measurements/);
  await assert.rejects(loadMeasurements(database({authThrows:true}).client,'user-a'),/sesión/);
  await assert.rejects(saveMeasurements(database({authError:true}).client,'user-a',{}),/sesión/);
});

test('malformed stored data is rejected, and invalid input never issues an insert',async()=>{
  const {client,calls}=database();await assert.rejects(saveMeasurements(client,'user-a',{tlx:101}));assert(!calls.some(([name])=>name==='insert'));
  for(const row of [
    {id:'bad',user_id:'user-a',measurements:{tlx:101},created_at:'2026-11-15T00:00:00Z'},
    {id:'bad',user_id:'user-a',measurements:{pvt:250},created_at:'invalid'},
    {id:'bad',user_id:'user-a',measurements:null,created_at:'2026-11-15T00:00:00Z'},
  ])await assert.rejects(loadMeasurements(database({badRow:row}).client,'user-a'));
});
