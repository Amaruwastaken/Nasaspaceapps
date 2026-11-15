// App thresholds supplied in Nuevas metricas.pdf; not clinical diagnoses.
export const metrics = [
  {id:'pvt',source:'manual',group:'brain',name:'Tiempo de reacción (PVT)',unit:'ms',step:'1',ranges:'Normal ≤ 265 · Atención > 265–<500 · Alerta ≥ 500'},
  {id:'tlx',source:'manual',group:'brain',name:'Carga NASA-TLX',unit:'puntos /100',max:100,step:'1',ranges:'Normal ≤ 45 · Atención > 45–<75 · Alerta ≥ 75'},
  {id:'amsler',source:'manual',group:'eyes',name:'Resultado del test Amsler',options:[['green','Sin distorsión visual'],['yellow','Líneas onduladas / vista cansada'],['red','Mancha borrosa / distorsión severa']],ranges:'Selecciona el resultado observado.'},
  {id:'sleep',source:'database',group:'brain',name:'Horas de sueño',unit:'h/noche',max:24},
  {id:'hrv',source:'database',group:'heart',name:'Variabilidad cardíaca (RMSSD)',unit:'ms'},
  {id:'heartRate',source:'database',group:'heart',name:'Pulso en reposo',unit:'bpm'},
  {id:'co2',source:'database',group:'brain',name:'Concentración de CO₂',unit:'ppm'},
  {id:'fluids',source:'database',group:'stomach',organs:['stomach','kidneys'],name:'Ingesta de líquidos',unit:'L/día'},
  {id:'radiation',source:'database',group:'body',name:'Radiación diaria',unit:'mSv/día'},
  {id:'dose',source:'database',group:'body',name:'Radiación acumulada',unit:'mSv'},
  {id:'gravity',source:'database',group:'environment',name:'Gravedad',options:[['green','1 G estable'],['yellow','Gravedad lunar / marciana'],['red','Microgravedad prolongada / transición reciente']]},
  {id:'pressure',source:'database',group:'environment',name:'Presión de cabina',unit:'kPa'},
  {id:'ventilation',source:'database',group:'environment',name:'Ventilación',unit:'m/s'},
];
export const manualMetrics = metrics.filter(m => m.source === 'manual');
export const groups = {brain:{name:'Cerebro'},heart:{name:'Corazón'},eyes:{name:'Ojos'},stomach:{name:'Estómago'},kidneys:{name:'Riñones'},body:{name:'Cuerpo'}};
export function classify(metric,raw,values = {}) {
  if (raw === '' || raw === undefined || raw === null) return 'missing';
  if (metric.options) return metric.options.some(([key]) => key === raw) ? raw : 'invalid';
  if (!['string','number'].includes(typeof raw)) return 'invalid';
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0 || (metric.max !== undefined && v > metric.max)) return 'invalid';
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
    case 'pressure': return v < 95 ? 'red' : v < 98 ? 'yellow' : v <= 102.5 ? 'green' : 'unknown';
    case 'ventilation': return v < .05 ? 'red' : v < .08 ? 'yellow' : v <= .2 ? 'green' : 'unknown';
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
