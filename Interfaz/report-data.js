// App thresholds are orientative and not clinical diagnoses.
export const metrics = [
  {id:'pvt',source:'manual',group:'brain',name:'Reaction time (PVT)',unit:'ms',step:'1',example:'250 ms',ranges:'Normal ≤ 265 · Caution > 265–<500 · Alert ≥ 500'},
  {id:'tlx',source:'manual',group:'brain',name:'NASA-TLX workload',unit:'points /100',max:100,step:'1',example:'20 out of 100 points',ranges:'Normal ≤ 45 · Caution > 45–<75 · Alert ≥ 75'},
  {id:'amsler',source:'manual',group:'eyes',name:'Amsler grid result',options:[['green','No visual distortion'],['yellow','Wavy lines / eye strain'],['red','Blurred spot / severe distortion']],example:'No visual distortion',ranges:'Select the result you observed.'},
  {id:'sleep',source:'database',group:'brain',name:'Sleep duration',unit:'h/night',max:24},
  {id:'hrv',source:'database',group:'heart',name:'Heart rate variability (RMSSD)',unit:'ms'},
  {id:'heartRate',source:'database',group:'heart',name:'Resting heart rate',unit:'bpm'},
  {id:'co2',source:'database',group:'brain',name:'CO₂ concentration',unit:'ppm'},
  {id:'fluids',source:'database',group:'stomach',organs:['stomach','kidneys'],name:'Fluid intake',unit:'L/day'},
  {id:'radiation',source:'database',group:'body',name:'Whole-body radiation rate',unit:'mSv/day'},
  {id:'dose',source:'database',group:'body',name:'Cumulative radiation',unit:'mSv'},
  {id:'gravity',source:'database',group:'environment',name:'Gravity field',unit:'G'},
  {id:'pressure',source:'database',group:'environment',name:'Cabin pressure',unit:'kPa'},
  {id:'ventilation',source:'database',group:'environment',name:'Ventilation flow',unit:'m/s'},
  {id:'bloodPressure',source:'database',group:'heart',name:'Blood pressure',unit:'mmHg'},
  {id:'heartRecovery',source:'database',group:'heart',name:'Heart rate recovery (1 min)',unit:'bpm'},
  {id:'arrhythmia',source:'database',group:'heart',name:'Irregular heart rhythm events',unit:'events/24 h'},
  {id:'perfusion',source:'manual',group:'body',name:'Peripheral perfusion (capillary refill)',unit:'s',step:'0.1',min:0,example:'1.5 s',ranges:'Green < 2 s · Red ≥ 2 s (no yellow range is defined).'},
  {id:'glucose',source:'database',group:'body',name:'Fasting blood glucose',unit:'mg/dL'},
  {id:'bmr',source:'database',group:'body',name:'Basal metabolic rate vs. baseline',unit:'ratio',min:0,max:2},
  {id:'bodyFat',source:'database',group:'body',name:'Body fat percentage',unit:'%',max:100},
  {id:'calories',source:'database',group:'body',name:'Calorie intake vs. daily target',unit:'%',max:200},
  {id:'sodium',source:'database',group:'body',name:'Sodium intake',unit:'mg/day'},
  {id:'calcium',source:'database',group:'body',name:'Calcium intake',unit:'mg/day'},
  {id:'vitaminD',source:'database',group:'body',name:'Vitamin D intake',unit:'IU/day'},
  {id:'caffeine',source:'database',group:'brain',name:'Caffeine intake',unit:'mg/day'},
  {id:'sleepApnea',source:'database',group:'body',name:'Breathing disruptions during sleep',unit:'events/h'},
  {id:'medication',source:'manual',group:'body',name:'Medication and supplement tracking',example:'100%, no double doses',fields:[
    {id:'takenPercent',label:'Percentage of doses taken on time',max:100,step:'1',example:'95%'},
    {id:'doubleDose',label:'Was there an accidental double dose?',options:[['no','No'],['yes','Yes']]},
  ],ranges:'Normal ≥ 95% · Caution 80–94% · Alert < 80% or accidental double dose.'},
  {id:'spo2',source:'database',group:'body',name:'Oxygen saturation (SpO₂)',unit:'%',max:100},
  {id:'oxygen',source:'database',group:'environment',name:'Cabin oxygen',unit:'%',max:100},
  {id:'respiratoryRate',source:'database',group:'body',name:'Respiratory rate',unit:'breaths/min',ranges:'Green 12–20 · Yellow 10–<12 or >20–24 · The specification repeats the yellow range for red, so those values remain unclassified.'},
  {id:'temperature',source:'database',group:'body',name:'Body temperature',unit:'°C'},
  {id:'sleepEfficiency',source:'database',group:'brain',name:'Sleep efficiency',unit:'%',max:100},
  {id:'orthostatic',source:'manual',group:'heart',name:'Orthostatic (standing) test',example:'ΔHR 10, ΔSBP 5, ΔDBP 0 mmHg; no dizziness',fields:[
    {id:'hrRise',label:'Heart rate increase (ΔHR)',unit:'bpm',min:0,step:'1'},
    {id:'systolicDrop',label:'Systolic blood pressure drop (ΔSBP)',unit:'mmHg',min:0,step:'1'},
    {id:'diastolicDrop',label:'Diastolic blood pressure drop (ΔDBP)',unit:'mmHg',min:0,step:'1'},
    {id:'symptoms',label:'Symptoms when standing',options:[['none','No dizziness'],['dizzy','Mild dizziness'],['presyncope','Near fainting'],['syncope','Fainting']]},
  ],ranges:'Normal: ΔHR < 20 and systolic drop < 10 mmHg. Caution: ΔHR 20–29, systolic drop 10–19, or mild dizziness. Alert: ΔHR ≥ 30, systolic drop ≥ 20, ΔDBP ≥ 10, near fainting, or fainting.'},
  {id:'who5',source:'manual',group:'brain',name:'Psychological well-being (WHO-5)',unit:'points /100',max:100,step:'1',example:'60 out of 100 points',ranges:'Normal ≥ 50 · Caution 29–49 · Alert ≤ 28'},
  {id:'hemoglobin',source:'database',group:'body',name:'Hemoglobin',unit:'g/dL'},
  {id:'leanMassChange',source:'database',group:'body',name:'Lean mass change vs. baseline',unit:'%',min:-100,max:100},
  {id:'boneDensity',source:'database',group:'body',name:'Bone density (DXA) and monthly loss',unit:'T-score / %/month'},
];
export const manualMetrics = metrics.filter(m => m.source === 'manual');
export const groups = {brain:{name:'Brain'},heart:{name:'Heart'},eyes:{name:'Eyes'},stomach:{name:'Stomach'},kidneys:{name:'Kidneys'},body:{name:'Body'}};
export function classify(metric,raw,values = {}) {
  if (raw === '' || raw === undefined || raw === null) return 'missing';
  if (metric.options) return metric.options.some(([key]) => key === raw) ? raw : 'invalid';
  if (metric.fields) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'invalid';
    if (metric.fields.some(field => raw[field.id] === undefined || raw[field.id] === '')) return 'missing';
    if (metric.id === 'medication') {
      const percent = Number(raw.takenPercent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100 || !['yes','no'].includes(raw.doubleDose)) return 'invalid';
      return raw.doubleDose === 'yes' || percent < 80 ? 'red' : percent < 95 ? 'yellow' : 'green';
    }
    if (metric.id === 'orthostatic') {
      const hr = Number(raw.hrRise), systolic = Number(raw.systolicDrop), diastolic = Number(raw.diastolicDrop);
      if ([hr,systolic,diastolic].some(value => !Number.isFinite(value) || value < 0) || !['none','dizzy','presyncope','syncope'].includes(raw.symptoms)) return 'invalid';
      if (hr >= 30 || systolic >= 20 || diastolic >= 10 || raw.symptoms === 'presyncope' || raw.symptoms === 'syncope') return 'red';
      if (hr >= 20 || systolic >= 10 || raw.symptoms === 'dizzy') return 'yellow';
      return 'green';
    }
    return 'invalid';
  }
  if (metric.id === 'bloodPressure') {
    const match = typeof raw === 'string' && raw.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
    if (!match) return 'invalid';
    const systolic = Number(match[1]), diastolic = Number(match[2]);
    if (systolic >= 140 || diastolic >= 90 || systolic < 85 || diastolic < 50) return 'red';
    if ((systolic >= 95 && systolic <= 125) && (diastolic >= 60 && diastolic <= 80)) return 'green';
    if ((systolic >= 85 && systolic < 95) || (systolic > 125 && systolic < 140) ||
        (diastolic >= 50 && diastolic < 60) || (diastolic > 80 && diastolic < 90)) return 'yellow';
    return 'unknown';
  }
  if (metric.id === 'bodyFat' || metric.id === 'hemoglobin') {
    if (typeof raw === 'number' || typeof raw === 'string') return 'unknown';
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'invalid';
    const value = Number(raw.value), sex = raw.sex;
    if (!Number.isFinite(value) || !['male','female'].includes(sex)) return 'invalid';
    if (metric.id === 'bodyFat') {
      const green = sex === 'male' ? [10,18] : [18,25];
      const yellow = sex === 'male' ? [19,23] : [26,30];
      if (value >= green[0] && value <= green[1]) return 'green';
      if (value >= yellow[0] && value <= yellow[1]) return 'yellow';
      if (value > yellow[1] || value < 8) return 'red';
      return 'unknown';
    }
    const normal = sex === 'male' ? 13 : 12;
    if (value >= normal) return 'green';
    if (value >= 11) return 'yellow';
    return 'red';
  }
  if (metric.id === 'boneDensity') {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'invalid';
    const tScore = Number(raw.tScore), monthlyLoss = Number(raw.monthlyLoss);
    if (!Number.isFinite(tScore) || !Number.isFinite(monthlyLoss) || monthlyLoss < 0) return 'invalid';
    if (tScore <= -2.5 || monthlyLoss > 1) return 'red';
    if ((tScore < -1 && tScore > -2.5) || (monthlyLoss >= .5 && monthlyLoss <= 1)) return 'yellow';
    if (tScore >= -1 && monthlyLoss < .5) return 'green';
    return 'unknown';
  }
  if (!['string','number'].includes(typeof raw)) return 'invalid';
  const v = Number(raw);
  if (!Number.isFinite(v) || v < (metric.min ?? 0) || (metric.max !== undefined && v > metric.max)) return 'invalid';
  switch (metric.id) {
    case 'sleep': return v >= 7.5 ? 'green' : v >= 6 ? 'yellow' : Number(values.sleepDays) >= 3 ? 'red' : 'unknown';
    case 'pvt': return v <= 265 ? 'green' : v < 500 ? 'yellow' : 'red';
    case 'tlx': return v <= 45 ? 'green' : v < 75 ? 'yellow' : 'red';
    case 'hrv': return v >= 50 ? 'green' : v >= 35 ? 'yellow' : 'red';
    case 'heartRate': return v < 45 || v > 105 ? 'red' : v >= 55 && v <= 85 ? 'green' : 'yellow';
    case 'co2': return v < 1500 ? 'green' : v <= 3500 ? 'yellow' : 'red';
    case 'fluids': return v < 1.5 ? 'red' : v < 1.8 ? 'yellow' : v <= 2.5 ? 'green' : 'unknown';
    case 'radiation': return v < .5 ? 'green' : v <= 1.5 ? 'yellow' : 'red';
    case 'dose': return v < 300 ? 'green' : v <= 479 ? 'yellow' : v >= 600 ? 'red' : 'unknown';
    case 'gravity': return v >= .9 && v <= 1.1 ? 'green' : v > 0 && v < .9 ? 'yellow' : v === 0 ? 'red' : 'unknown';
    case 'pressure': return v < 95 ? 'red' : v < 98 ? 'yellow' : v <= 102.5 ? 'green' : 'unknown';
    case 'ventilation': return v < .05 ? 'red' : v < .08 ? 'yellow' : v <= .2 ? 'green' : 'unknown';
    case 'heartRecovery': return v >= 20 ? 'green' : v >= 12 ? 'yellow' : 'red';
    case 'arrhythmia': return v === 0 ? 'green' : v < 2 ? 'yellow' : 'red';
    case 'glucose': return v >= 70 && v <= 105 ? 'green' : v >= 106 && v <= 125 ? 'yellow' : v > 125 || v < 65 ? 'red' : 'unknown';
    case 'bmr': return v >= .9 ? 'green' : v >= .85 ? 'yellow' : 'red';
    case 'bodyFat': return 'unknown';
    case 'calories': return v >= 90 ? 'green' : v >= 75 ? 'yellow' : 'red';
    case 'sodium': return v >= 1500 && v <= 2300 ? 'green' : v <= 3000 && v > 2300 ? 'yellow' : v > 3000 ? 'red' : 'unknown';
    case 'calcium': return v >= 1000 && v <= 1200 ? 'green' : (v >= 750 && v < 1000) || (v > 1200 && v <= 1500) ? 'yellow' : v < 750 || v > 1500 ? 'red' : 'unknown';
    case 'vitaminD': return v >= 800 && v <= 1000 ? 'green' : v >= 400 && v < 800 ? 'yellow' : v < 400 ? 'red' : 'unknown';
    case 'caffeine': return v <= 200 ? 'green' : v <= 400 ? 'yellow' : 'red';
    case 'sleepApnea': return v < 5 ? 'green' : v < 15 ? 'yellow' : 'red';
    case 'spo2': return v >= 95 ? 'green' : v >= 92 ? 'yellow' : 'red';
    case 'oxygen': return v >= 20 && v <= 23 ? 'green' : (v >= 19.5 && v < 20) || (v > 23 && v <= 23.5) ? 'yellow' : 'red';
    case 'respiratoryRate': return v >= 12 && v <= 20 ? 'green' : (v >= 10 && v < 12) || (v > 20 && v <= 24) ? 'yellow' : 'unknown';
    case 'temperature': return v >= 36.1 && v <= 37.2 ? 'green' : ((v > 37.2 && v < 38) || (v >= 35.5 && v < 36.1)) ? 'yellow' : (v >= 38 || v < 35.5) ? 'red' : 'unknown';
    case 'sleepEfficiency': return v >= 85 ? 'green' : v >= 75 ? 'yellow' : 'red';
    case 'perfusion': return v < 2 ? 'green' : 'red';
    case 'who5': return v >= 50 ? 'green' : v >= 29 ? 'yellow' : 'red';
    case 'leanMassChange': return v >= -2 ? 'green' : v >= -5 ? 'yellow' : 'red';
    case 'hemoglobin': return 'unknown';
    default:return 'unknown';
  }
}
export function affectedOrgans(values) {
  const organs = new Map();
  for (const metric of metrics) {
    const state = classify(metric,values[metric.id],values);
    if (state !== 'yellow' && state !== 'red') continue;
    for (const id of metric.organs ?? [metric.group]) {
      if (!groups[id]) continue;
      if (!organs.has(id)) organs.set(id,{id,name:groups[id].name,state,items:[]});
      const organ = organs.get(id);
      if (state === 'red') organ.state = 'red';
      organ.items.push({metric,value:values[metric.id],state});
    }
  }
  return [...organs.values()].sort((a,b) => Number(b.state === 'red')-Number(a.state === 'red'));
}
export function emergencyScore(values) {
  const score = metrics
    .filter(metric => metric.group !== 'environment')
    .reduce((total,metric) => {
      const state = classify(metric,values[metric.id],values);
      return total + (state === 'red' ? 2 : state === 'yellow' ? 1.25 : 0);
    },0);
  return Math.round(score);
}
