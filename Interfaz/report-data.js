// App thresholds are orientative and not clinical diagnoses.
export const metrics = [
  {id:'pvt',source:'manual',group:'brain',name:'Reaction time (PVT)',unit:'ms',step:'1',example:'250 ms',ranges:'Normal ≤ 265 · Caution > 265–<500 · Alert ≥ 500'},
  {id:'tlx',source:'manual',group:'brain',name:'NASA-TLX workload',unit:'points /100',max:100,step:'1',example:'20 out of 100 points',ranges:'Normal ≤ 45 · Caution > 45–<75 · Alert ≥ 75'},
  {id:'amsler',source:'manual',group:'eyes',organs:['brain','eyes'],name:'Amsler grid result',options:[['green','No visual distortion'],['yellow','Wavy lines / eye strain'],['red','Blurred spot / severe distortion']],example:'No visual distortion',ranges:'Select the result you observed.'},
  {id:'sleep',source:'database',group:'brain',name:'Sleep duration',unit:'h/night',max:24},
  {id:'hrv',source:'database',group:'heart',name:'Heart rate variability (RMSSD)',unit:'ms'},
  {id:'heartRate',source:'database',group:'heart',name:'Resting heart rate',unit:'bpm'},
  {id:'co2',source:'database',group:'lungs',name:'CO₂ concentration',unit:'ppm'},
  {id:'fluids',source:'manual',group:'body',organs:['body','stomach','kidneys'],name:'Fluid intake',unit:'L/day',max:20,step:'0.1',example:'2.0 L/day',ranges:'Record intake; use mission medical guidance for personal targets.'},
  {id:'radiation',source:'database',group:'brain',organs:['brain','body'],name:'Whole-body radiation rate',unit:'mSv/day'},
  {id:'dose',source:'database',group:'brain',organs:['brain','body'],name:'Cumulative radiation',unit:'mSv'},
  {id:'gravity',source:'database',group:'body',name:'Gravity field',unit:'G'},
  {id:'pressure',source:'database',group:'lungs',name:'Cabin pressure',unit:'kPa',min:0,max:200,step:'0.1'},
  {id:'ventilation',source:'database',group:'lungs',name:'Ventilation flow',unit:'m/s',min:0,max:10,step:'0.01'},
  {id:'bloodPressure',source:'database',group:'heart',organs:['heart','kidneys'],name:'Blood pressure',fields:[
    {id:'systolic',label:'Systolic pressure',unit:'mmHg',min:40,max:300,step:'1'},
    {id:'diastolic',label:'Diastolic pressure',unit:'mmHg',min:20,max:200,step:'1'},
  ],ranges:'Record both values; interpretation depends on the astronaut and mission medical guidance.'},
  {id:'heartRecovery',source:'database',group:'heart',name:'Heart rate recovery (1 min)',unit:'bpm',min:0,max:250,step:'1'},
  {id:'arrhythmia',source:'database',group:'heart',name:'Irregular heart rhythm events',unit:'events/24 h',min:0,max:1000,step:'1'},
  {id:'perfusion',source:'database',group:'heart',name:'Peripheral perfusion (capillary refill)',unit:'s',step:'0.1',min:0,max:30,example:'1.5 s',ranges:'Green < 2 s · Red ≥ 2 s (no yellow range is defined).'},
  {id:'glucose',source:'database',group:'body',name:'Fasting blood glucose',unit:'mg/dL'},
  {id:'bmr',source:'database',group:'body',name:'Basal metabolic rate vs. baseline',unit:'ratio',min:0,max:3,step:'0.01'},
  {id:'bodyFat',source:'database',group:'body',name:'Body fat percentage',unit:'%',min:0,max:100,step:'0.1'},
  {id:'calories',source:'manual',group:'body',name:'Calorie intake vs. daily target',unit:'%',max:300,step:'1'},
  {id:'sodium',source:'manual',group:'body',organs:['body','kidneys'],name:'Sodium intake',unit:'mg/day',max:20000,step:'1'},
  {id:'calcium',source:'manual',group:'body',name:'Calcium intake',unit:'mg/day',max:20000,step:'1'},
  {id:'vitaminD',source:'manual',group:'body',name:'Vitamin D intake',unit:'IU/day',max:100000,step:'1'},
  {id:'caffeine',source:'database',group:'brain',name:'Caffeine intake',unit:'mg/day'},
  {id:'sleepApnea',source:'manual',group:'lungs',name:'Breathing disruptions during sleep',unit:'events/h',max:100,step:'1'},
  {id:'medication',source:'manual',group:'body',name:'Medication and supplement tracking',example:'100%, no double doses',fields:[
    {id:'takenPercent',label:'Percentage of doses taken on time',max:100,step:'1',example:'95%'},
    {id:'doubleDose',label:'Was there an accidental double dose?',options:[['no','No'],['yes','Yes']]},
  ],ranges:'Normal ≥ 95% · Caution 80–94% · Alert < 80% or accidental double dose.'},
  {id:'spo2',source:'database',group:'body',name:'Oxygen saturation (SpO₂)',unit:'%',max:100},
  {id:'oxygen',source:'database',group:'lungs',name:'Cabin oxygen',unit:'%',min:0,max:100,step:'0.1'},
  {id:'respiratoryRate',source:'database',group:'lungs',name:'Respiratory rate',unit:'breaths/min',ranges:'Green 12–20 · Yellow 10–<12 or >20–24 · The specification repeats the yellow range for red, so those values remain unclassified.'},
  {id:'temperature',source:'database',group:'body',name:'Body temperature',unit:'°C'},
  {id:'sleepEfficiency',source:'database',group:'brain',name:'Sleep efficiency',unit:'%',max:100,step:'1'},
  {id:'orthostatic',source:'database',group:'heart',name:'Orthostatic (standing) test',example:'ΔHR 10, ΔSBP 5, ΔDBP 0 mmHg; no dizziness',fields:[
    {id:'hrRise',label:'Heart rate increase (ΔHR)',unit:'bpm',min:0,step:'1'},
    {id:'systolicDrop',label:'Systolic blood pressure drop (ΔSBP)',unit:'mmHg',min:0,step:'1'},
    {id:'diastolicDrop',label:'Diastolic blood pressure drop (ΔDBP)',unit:'mmHg',min:0,step:'1'},
    {id:'symptoms',label:'Symptoms when standing',options:[['none','No dizziness'],['dizzy','Mild dizziness'],['presyncope','Near fainting'],['syncope','Fainting']]},
  ],ranges:'Normal: ΔHR < 20 and systolic drop < 10 mmHg. Caution: ΔHR 20–29, systolic drop 10–19, or mild dizziness. Alert: ΔHR ≥ 30, systolic drop ≥ 20, ΔDBP ≥ 10, near fainting, or fainting.'},
  {id:'who5',source:'manual',group:'brain',name:'Psychological well-being (WHO-5)',unit:'points /100',max:100,step:'1',example:'60 out of 100 points',ranges:'Normal ≥ 50 · Caution 29–49 · Alert ≤ 28'},
  {id:'hemoglobin',source:'database',group:'heart',name:'Hemoglobin',unit:'g/dL',min:0,max:30,step:'0.1'},
  {id:'leanMassChange',source:'database',group:'body',name:'Lean mass change vs. baseline',unit:'%',min:-100,max:100,step:'0.1'},
  {id:'boneDensity',source:'database',group:'body',name:'Bone density (DXA) and monthly loss',fields:[
    {id:'tScore',label:'DXA T-score',min:-5,max:5,step:'0.1'},
    {id:'monthlyLoss',label:'Monthly bone loss',unit:'%',min:0,max:20,step:'0.01'},
  ],ranges:'Record the measured values; follow the flight surgeon’s interpretation.'},
  {id:'alt',source:'database',group:'liver',name:'ALT (alanine aminotransferase)',unit:'U/L',min:0,max:10000,step:'0.1'},
  {id:'ast',source:'database',group:'liver',name:'AST (aspartate aminotransferase)',unit:'U/L',min:0,max:10000,step:'0.1'},
  {id:'bilirubin',source:'database',group:'liver',name:'Bilirubin',unit:'mg/dL',min:0,max:100,step:'0.01'},
  {id:'nauseaScore',source:'manual',group:'stomach',name:'Nausea score',unit:'/10',min:0,max:10,step:'1'},
  {id:'appetite',source:'manual',group:'stomach',name:'Appetite level',unit:'/10',min:0,max:10,step:'1'},
  {id:'gastricSymptoms',source:'manual',group:'stomach',organs:['stomach','intestines'],name:'Gastric symptoms',fields:[
    {id:'bloating',label:'Bloating severity',unit:'/10',min:0,max:10,step:'1'},
    {id:'indigestion',label:'Indigestion severity',unit:'/10',min:0,max:10,step:'1'},
    {id:'abdominalDiscomfort',label:'Abdominal discomfort',unit:'/10',min:0,max:10,step:'1'},
  ]},
  {id:'urineOutput',source:'database',group:'kidneys',name:'Urine output',unit:'mL/day',min:0,max:20000,step:'1'},
  {id:'urineSpecificGravity',source:'database',group:'kidneys',name:'Urine specific gravity',min:1,max:1.1,step:'0.001'},
  {id:'creatinine',source:'database',group:'kidneys',name:'Creatinine',unit:'mg/dL',min:0,max:100,step:'0.01'},
  {id:'bun',source:'database',group:'kidneys',name:'Blood urea nitrogen (BUN)',unit:'mg/dL',min:0,max:1000,step:'0.1'},
  {id:'bowelFrequency',source:'manual',group:'intestines',name:'Bowel movement frequency',unit:'movements/day',min:0,max:50,step:'1'},
  {id:'stoolConsistency',source:'manual',group:'intestines',name:'Stool consistency (Bristol Stool Scale)',options:[['type1','Type 1'],['type2','Type 2'],['type3','Type 3'],['type4','Type 4'],['type5','Type 5'],['type6','Type 6'],['type7','Type 7']]},
  {id:'fiber',source:'manual',group:'intestines',name:'Fiber intake',unit:'g/day',min:0,max:1000,step:'1'},
];
export const manualMetrics = metrics.filter(m => m.source === 'manual');
export const groups = {brain:{name:'Brain'},heart:{name:'Heart'},eyes:{name:'Eyes'},lungs:{name:'Lungs'},liver:{name:'Liver'},stomach:{name:'Stomach'},kidneys:{name:'Kidneys'},intestines:{name:'Intestines'},body:{name:'Body'}};
export function classify(metric,raw,values = {}) {
  if (raw === '' || raw === undefined || raw === null) return 'missing';
  if (metric.options) {
    if (!metric.options.some(([key]) => key === raw)) return 'invalid';
    if (['green','yellow','red'].includes(raw)) return raw;
    if (metric.id === 'stoolConsistency') return ({type1:'yellow',type2:'yellow',type3:'green',type4:'green',type5:'green',type6:'yellow',type7:'red'})[raw];
    return 'unknown';
  }
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
    if (metric.id === 'bloodPressure') {
      const systolic = Number(raw.systolic), diastolic = Number(raw.diastolic);
      if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return 'invalid';
      if (systolic >= 140 || diastolic >= 90 || systolic < 85 || diastolic < 50) return 'red';
      if (systolic >= 95 && systolic <= 125 && diastolic >= 60 && diastolic <= 80) return 'green';
      if ((systolic >= 85 && systolic < 95) || (systolic > 125 && systolic < 140) || (diastolic >= 50 && diastolic < 60) || (diastolic > 80 && diastolic < 90)) return 'yellow';
      return 'yellow';
    }
    if (metric.id === 'boneDensity') {
      const tScore = Number(raw.tScore), monthlyLoss = Number(raw.monthlyLoss);
      if (!Number.isFinite(tScore) || !Number.isFinite(monthlyLoss) || monthlyLoss < 0) return 'invalid';
      if (tScore <= -2.5 || monthlyLoss > 1) return 'red';
      if ((tScore < -1 && tScore > -2.5) || (monthlyLoss >= .5 && monthlyLoss <= 1)) return 'yellow';
      return 'green';
    }
    if (metric.id === 'gastricSymptoms') {
      const scores = metric.fields.map(field => Number(raw[field.id]));
      if (scores.some(value => !Number.isFinite(value) || value < 0 || value > 10)) return 'invalid';
      const max = Math.max(...scores);
      return max >= 6 ? 'red' : max >= 2 ? 'yellow' : 'green';
    }
    return 'unknown';
  }
  if (metric.id === 'bloodPressure') {
    const match = typeof raw === 'string' && raw.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
    if (!match) return 'invalid';
    const systolic = Number(match[1]), diastolic = Number(match[2]);
    if (systolic >= 140 || diastolic >= 90 || systolic < 85 || diastolic < 50) return 'red';
    if ((systolic >= 95 && systolic <= 125) && (diastolic >= 60 && diastolic <= 80)) return 'green';
    if ((systolic >= 85 && systolic < 95) || (systolic > 125 && systolic < 140) ||
        (diastolic >= 50 && diastolic < 60) || (diastolic > 80 && diastolic < 90)) return 'yellow';
    return 'yellow';
  }
  if (metric.id === 'bodyFat' || metric.id === 'hemoglobin') {
    if (metric.id === 'bodyFat' && (typeof raw === 'number' || typeof raw === 'string')) return 'unknown';
    if (metric.id === 'hemoglobin' && (typeof raw === 'number' || typeof raw === 'string')) {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 30) return 'invalid';
      return value < 11 ? 'red' : value < 13.8 ? 'yellow' : value <= 15.1 ? 'green' : value <= 17.2 ? 'yellow' : 'red';
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'invalid';
    const value = Number(raw.value), sex = raw.sex;
    if (!Number.isFinite(value) || !['male','female'].includes(sex)) return 'invalid';
    if (metric.id === 'bodyFat') {
      if (raw.age !== undefined && (!Number.isInteger(raw.age) || raw.age < 18 || raw.age > 120)) return 'invalid';
      // Adult DXA categories: these are descriptive population bands, not a diagnosis.
      if (sex === 'female') return value < 15 || value >= 35 ? 'red' : value < 20 || value >= 30 ? 'yellow' : 'green';
      return value < 10 || value >= 30 ? 'red' : value < 15 || value >= 25 ? 'yellow' : 'green';
    }
    if (value < 11) return 'red';
    if (sex === 'female') return value < 12.1 ? 'yellow' : value <= 15.1 ? 'green' : value <= 17.2 ? 'yellow' : 'red';
    return value < 13.8 ? 'yellow' : value <= 17.2 ? 'green' : value <= 20 ? 'yellow' : 'red';
  }
  if (metric.id === 'boneDensity') {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'invalid';
    const tScore = Number(raw.tScore), monthlyLoss = Number(raw.monthlyLoss);
    if (!Number.isFinite(tScore) || !Number.isFinite(monthlyLoss) || monthlyLoss < 0) return 'invalid';
    if (tScore <= -2.5 || monthlyLoss > 1) return 'red';
    if ((tScore < -1 && tScore > -2.5) || (monthlyLoss >= .5 && monthlyLoss <= 1)) return 'yellow';
    if (tScore >= -1 && monthlyLoss < .5) return 'green';
    return 'yellow';
  }
  if (!['string','number'].includes(typeof raw)) return 'invalid';
  const v = Number(raw);
  if (!Number.isFinite(v) || v < (metric.min ?? 0) || (metric.max !== undefined && v > metric.max)) return 'invalid';
  switch (metric.id) {
    case 'sleep': return v >= 7.5 ? 'green' : v >= 6 ? 'yellow' : Number(values.sleepDays) >= 3 ? 'red' : 'yellow';
    case 'pvt': return v <= 265 ? 'green' : v < 500 ? 'yellow' : 'red';
    case 'tlx': return v <= 45 ? 'green' : v < 75 ? 'yellow' : 'red';
    case 'hrv': return v >= 50 ? 'green' : v >= 35 ? 'yellow' : 'red';
    case 'heartRate': return v < 45 || v > 105 ? 'red' : v >= 55 && v <= 85 ? 'green' : 'yellow';
    case 'co2': return v < 1500 ? 'green' : v <= 3500 ? 'yellow' : 'red';
    case 'fluids': return v < 1.5 ? 'red' : v < 1.8 ? 'yellow' : v <= 2.5 ? 'green' : 'yellow';
    case 'radiation': return v < .5 ? 'green' : v <= 1.5 ? 'yellow' : 'red';
    case 'dose': return v < 300 ? 'green' : v < 480 ? 'yellow' : v < 600 ? 'yellow' : 'red';
    case 'gravity': return v <= 1.1 ? 'green' : 'yellow';
    case 'pressure': return v < 34.5 || v > 103 ? 'red' : v < 95 || v > 102.5 ? 'yellow' : 'green';
    case 'ventilation': return v < .05 ? 'red' : v < .08 ? 'yellow' : v <= .2 ? 'green' : 'yellow';
    case 'heartRecovery': return v >= 20 ? 'green' : v >= 12 ? 'yellow' : 'red';
    case 'arrhythmia': return v === 0 ? 'green' : v < 2 ? 'yellow' : 'red';
    case 'glucose': return v >= 70 && v <= 105 ? 'green' : v >= 106 && v <= 125 ? 'yellow' : v > 125 || v < 65 ? 'red' : 'yellow';
    case 'bmr': return v >= .9 ? 'green' : v >= .85 ? 'yellow' : 'red';
    case 'bodyFat': return 'unknown';
    case 'calories': return v >= 90 ? 'green' : v >= 75 ? 'yellow' : 'red';
    case 'sodium': return v >= 1500 && v <= 2300 ? 'green' : v <= 3000 && v > 2300 ? 'yellow' : v > 3000 ? 'red' : 'yellow';
    case 'calcium': return v >= 1000 && v <= 1200 ? 'green' : (v >= 750 && v < 1000) || (v > 1200 && v <= 1500) ? 'yellow' : v < 750 || v > 1500 ? 'red' : 'unknown';
    case 'vitaminD': return v >= 600 && v <= 4000 ? 'green' : v < 600 ? 'yellow' : 'red';
    case 'caffeine': return v <= 200 ? 'green' : v <= 400 ? 'yellow' : 'red';
    case 'sleepApnea': return v < 5 ? 'green' : v < 15 ? 'yellow' : 'red';
    case 'spo2': return v >= 95 ? 'green' : v >= 92 ? 'yellow' : 'red';
    case 'oxygen': return v >= 20 && v <= 23 ? 'green' : (v >= 19.5 && v < 20) || (v > 23 && v <= 23.5) ? 'yellow' : 'red';
    case 'respiratoryRate': return v >= 12 && v <= 20 ? 'green' : v < 10 || v >= 30 ? 'red' : 'yellow';
    case 'temperature': return v >= 36.1 && v <= 37.2 ? 'green' : ((v > 37.2 && v < 38) || (v >= 35.5 && v < 36.1)) ? 'yellow' : (v >= 38 || v < 35.5) ? 'red' : 'unknown';
    case 'sleepEfficiency': return v >= 85 ? 'green' : v >= 75 ? 'yellow' : 'red';
    case 'perfusion': return v < 2 ? 'green' : 'red';
    case 'who5': return v >= 50 ? 'green' : v >= 29 ? 'yellow' : 'red';
    case 'leanMassChange': return v >= -2 ? 'green' : v >= -5 ? 'yellow' : 'red';
    case 'hemoglobin': return v < 11 ? 'red' : v < 13.8 ? 'yellow' : v <= 15.1 ? 'green' : v <= 17.2 ? 'yellow' : 'red';
    case 'alt': return v <= 34 ? 'green' : v <= 50 ? 'yellow' : 'red';
    case 'ast': return v <= 35 ? 'green' : v <= 50 ? 'yellow' : 'red';
    case 'bilirubin': return v >= 0.1 && v <= 1.2 ? 'green' : v <= 3 ? 'yellow' : 'red';
    case 'nauseaScore': return v <= 1 ? 'green' : v <= 5 ? 'yellow' : 'red';
    case 'appetite': return v >= 7 ? 'green' : v >= 4 ? 'yellow' : 'red';
    case 'urineOutput': return v < 500 ? 'red' : v < 1000 ? 'yellow' : v <= 2500 ? 'green' : 'yellow';
    case 'urineSpecificGravity': return v >= 1.005 && v <= 1.03 ? 'green' : 'yellow';
    case 'creatinine': return v >= 0.6 && v <= 1.3 ? 'green' : v <= 2.5 ? 'yellow' : 'red';
    case 'bun': return v >= 7 && v <= 20 ? 'green' : v <= 40 ? 'yellow' : 'red';
    case 'bowelFrequency': return v >= 1 && v <= 3 ? 'green' : v >= 6 ? 'red' : 'yellow';
    case 'fiber': return v >= 25 ? 'green' : v >= 15 ? 'yellow' : 'red';
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
