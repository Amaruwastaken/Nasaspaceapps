// App thresholds are orientative and not clinical diagnoses.
export const metrics = [
  {id:'pvt',source:'manual',group:'brain',name:'Tiempo de reacción (PVT)',unit:'ms',step:'1',example:'250 ms',ranges:'Normal ≤ 265 · Atención > 265–<500 · Alerta ≥ 500'},
  {id:'tlx',source:'manual',group:'brain',name:'Carga NASA-TLX',unit:'puntos /100',max:100,step:'1',example:'20 puntos de 100',ranges:'Normal ≤ 45 · Atención > 45–<75 · Alerta ≥ 75'},
  {id:'amsler',source:'manual',group:'eyes',name:'Resultado del test Amsler',options:[['green','Sin distorsión visual'],['yellow','Líneas onduladas / vista cansada'],['red','Mancha borrosa / distorsión severa']],example:'Sin distorsión visual',ranges:'Selecciona el resultado observado.'},
  {id:'sleep',source:'database',group:'brain',name:'Horas de sueño',unit:'h/noche',max:24},
  {id:'hrv',source:'database',group:'heart',name:'Variabilidad cardíaca (RMSSD)',unit:'ms'},
  {id:'heartRate',source:'database',group:'heart',name:'Ritmo cardíaco (FC en reposo)',unit:'bpm'},
  {id:'co2',source:'database',group:'brain',name:'Concentración de CO₂',unit:'ppm'},
  {id:'fluids',source:'database',group:'stomach',organs:['stomach','kidneys'],name:'Ingesta de líquidos',unit:'L/día'},
  {id:'radiation',source:'database',group:'body',name:'Tasa de radiación de cuerpo completo',unit:'mSv/día'},
  {id:'dose',source:'database',group:'body',name:'Radiación acumulada',unit:'mSv'},
  {id:'gravity',source:'database',group:'environment',name:'Campo gravitatorio',unit:'G'},
  {id:'pressure',source:'database',group:'environment',name:'Presión de cabina',unit:'kPa'},
  {id:'ventilation',source:'database',group:'environment',name:'Flujo de ventilación',unit:'m/s'},
  {id:'bloodPressure',source:'database',group:'heart',name:'Presión arterial',unit:'mmHg'},
  {id:'heartRecovery',source:'database',group:'heart',name:'Recuperación cardíaca (1 min)',unit:'bpm'},
  {id:'arrhythmia',source:'database',group:'heart',name:'Eventos de ritmo cardíaco irregular',unit:'eventos/24 h'},
  {id:'perfusion',source:'manual',group:'body',name:'Perfusión periférica (relleno capilar)',unit:'s',step:'0.1',min:0,example:'1.5 s',ranges:'Verde < 2 s · Rojo ≥ 2 s (no hay rango amarillo definido).'},
  {id:'glucose',source:'database',group:'body',name:'Glucosa en sangre en ayunas',unit:'mg/dL'},
  {id:'bmr',source:'database',group:'body',name:'Metabolismo basal vs. línea base',unit:'proporción',min:0,max:2},
  {id:'bodyFat',source:'database',group:'body',name:'Porcentaje de grasa corporal',unit:'%',max:100},
  {id:'calories',source:'database',group:'body',name:'Ingesta calórica vs. meta diaria',unit:'%',max:200},
  {id:'sodium',source:'database',group:'body',name:'Ingesta de sodio',unit:'mg/día'},
  {id:'calcium',source:'database',group:'body',name:'Ingesta de calcio',unit:'mg/día'},
  {id:'vitaminD',source:'database',group:'body',name:'Ingesta de vitamina D',unit:'UI/día'},
  {id:'caffeine',source:'database',group:'brain',name:'Ingesta de cafeína',unit:'mg/día'},
  {id:'sleepApnea',source:'database',group:'body',name:'Alteraciones respiratorias al dormir',unit:'eventos/h'},
  {id:'medication',source:'manual',group:'body',name:'Control de medicamentos y suplementos',example:'100% y sin doble dosis',fields:[
    {id:'takenPercent',label:'Porcentaje de dosis tomadas a tiempo',max:100,step:'1',example:'95%'},
    {id:'doubleDose',label:'¿Hubo una doble dosis accidental?',options:[['no','No'],['yes','Sí']]},
  ],ranges:'Normal ≥ 95% · Atención 80–94% · Alerta < 80% o doble dosis accidental.'},
  {id:'spo2',source:'database',group:'body',name:'Saturación de oxígeno (SpO₂)',unit:'%',max:100},
  {id:'oxygen',source:'database',group:'environment',name:'Oxígeno de cabina',unit:'%',max:100},
  {id:'respiratoryRate',source:'database',group:'body',name:'Frecuencia respiratoria',unit:'rpm',ranges:'Verde 12–20 · Amarillo 10–<12 o >20–24 · El rango rojo repite el amarillo en la especificación y queda sin clasificar.'},
  {id:'temperature',source:'database',group:'body',name:'Temperatura corporal',unit:'°C'},
  {id:'sleepEfficiency',source:'database',group:'brain',name:'Eficiencia de sueño',unit:'%',max:100},
  {id:'orthostatic',source:'manual',group:'heart',name:'Prueba ortostática (de pie)',example:'ΔFC 10, ΔPAS 5, ΔPAD 0 mmHg; sin mareo',fields:[
    {id:'hrRise',label:'Aumento del pulso (ΔFC)',unit:'lpm',min:0,step:'1'},
    {id:'systolicDrop',label:'Caída de presión sistólica (ΔPAS)',unit:'mmHg',min:0,step:'1'},
    {id:'diastolicDrop',label:'Caída de presión diastólica (ΔPAD)',unit:'mmHg',min:0,step:'1'},
    {id:'symptoms',label:'Síntomas al ponerse de pie',options:[['none','Sin mareo'],['dizzy','Mareo leve'],['presyncope','Presíncope'],['syncope','Desmayo']]},
  ],ranges:'Normal: ΔFC < 20 y caída sistólica < 10 mmHg. Atención: ΔFC 20–29, caída sistólica 10–19 o mareo leve. Alerta: ΔFC ≥ 30, caída sistólica ≥ 20, ΔPAD ≥ 10, presíncope o desmayo.'},
  {id:'who5',source:'manual',group:'brain',name:'Bienestar psicológico (WHO-5)',unit:'puntos /100',max:100,step:'1',example:'60 puntos de 100',ranges:'Normal ≥ 50 · Atención 29–49 · Alerta ≤ 28'},
  {id:'hemoglobin',source:'database',group:'body',name:'Hemoglobina',unit:'g/dL'},
  {id:'leanMassChange',source:'database',group:'body',name:'Cambio de masa magra vs. línea base',unit:'%',min:-100,max:100},
  {id:'boneDensity',source:'database',group:'body',name:'Densidad ósea (DXA) y pérdida mensual',unit:'T-score / %/mes'},
];
export const manualMetrics = metrics.filter(m => m.source === 'manual');
export const groups = {brain:{name:'Cerebro'},heart:{name:'Corazón'},eyes:{name:'Ojos'},stomach:{name:'Estómago'},kidneys:{name:'Riñones'},body:{name:'Cuerpo'}};
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
