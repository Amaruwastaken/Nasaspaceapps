// Thresholds transcribed from Informacion.pdf. Unspecified ranges remain unclassified.
export const metrics = [
  {id:'sleep',group:'brain',name:'Horas de sueño',unit:'h/noche',step:'.1',max:24,ranges:'Verde ≥ 7.5 · Amarillo 6–<7.5 · Rojo < 6 durante 3+ días',note:'El PDF cita 6.1 h/noche en órbita frente a 8.5 h programadas.'},
  {id:'pvt',group:'brain',name:'Tiempo de reacción (PVT)',unit:'ms',step:'1',ranges:'Verde ≤ 265 · Amarillo > 265–<500 · Rojo ≥ 500',note:'El documento cita unos 265 ms durante el vuelo y una recuperación más lenta tras el retorno.'},
  {id:'hrv',group:'brain',name:'Variabilidad cardíaca (RMSSD)',unit:'ms',step:'.1',ranges:'Verde ≥ 50 · Amarillo 35–<50 · Rojo < 35',note:'El PDF relaciona aislamiento y carga operativa con menor actividad parasimpática.'},
  {id:'amsler',group:'eyes',name:'Resultado del test Amsler',options:[['green','Sin distorsión'],['yellow','Líneas onduladas / vista cansada'],['red','Mancha borrosa / distorsión severa']],ranges:'Verde: sin distorsión · Amarillo: líneas onduladas · Rojo: distorsión severa',note:'El documento describe cambios retinianos y del nervio óptico asociados al síndrome SANS.'},
  {id:'co2',group:'head',name:'Concentración de CO₂',unit:'ppm',step:'1',ranges:'Verde < 1500 · Amarillo 1500–3500 · Rojo > 3500',note:'El PDF cita unos 2850 ppm en la ISS, asociados a dolor de cabeza.'},
  {id:'fluids',group:'stomach',name:'Ingesta de líquidos',unit:'L/día',step:'.1',ranges:'Verde 1.8–2.5 · Amarillo 1.5–<1.8 · Rojo < 1.5',note:'El documento relaciona hidratación y volumen plasmático; valores > 2.5 L no tienen umbral definido.'},
  {id:'tlx',group:'body',name:'Carga NASA-TLX',unit:'puntos /100',max:100,step:'1',ranges:'Verde 0–45 · Amarillo > 45–<75 · Rojo ≥ 75',note:'El PDF cita una carga operativa de 55–68 puntos y picos durante EVA y retorno.'},
  {id:'calcium',group:'body',name:'Pérdida de calcio',unit:'mg/día',step:'1',ranges:'Verde < 250 · Amarillo 250–350 · Rojo > 350',note:'El PDF cita una pérdida ósea de aproximadamente 4.8% en un año con ejercicio ARED. No se infiere densidad ósea a partir del calcio.'},
  {id:'radiation',group:'environment',name:'Tasa de radiación',unit:'mSv/día',step:'.01',ranges:'Verde < 0.5 · Amarillo 0.5–1.5 · Rojo > 1.5',note:'Referencia del PDF: 0.43 mSv/día.'},
  {id:'dose',group:'environment',name:'Radiación acumulada',unit:'mSv',step:'.1',ranges:'Verde < 300 · Amarillo 300–479 · Rojo ≥ 600',note:'El intervalo > 479–<600 no está definido en el PDF; no se asigna color. Referencia: 146 mSv en 340 días.'},
  {id:'gravity',group:'environment',name:'Gravedad y transición',options:[['green','1 G estable'],['yellow','0.16 G (Luna) / 0.38 G (Marte)'],['red','0 G prolongado / transición < 72 h']],ranges:'Verde: 1 G estable · Amarillo: Luna / Marte · Rojo: 0 G prolongado o transición < 72 h',note:'Combina las dos filas sobre gravedad del PDF para evitar contar dos veces la misma exposición.'},
  {id:'pressure',group:'environment',name:'Presión de cabina',unit:'kPa',step:'.1',ranges:'Verde 98–102.5 · Amarillo 95–<98 · Rojo < 95',note:'El PDF cita 101.3 kPa en la ISS. Valores > 102.5 no tienen umbral definido.'},
  {id:'ventilation',group:'environment',name:'Flujo de ventilación',unit:'m/s',step:'.01',ranges:'Verde 0.08–0.20 · Amarillo 0.05–<0.08 · Rojo < 0.05',note:'Valores > 0.20 m/s no tienen umbral definido en el documento.'},
];
export const groups = {
  brain:{name:'Cerebro',description:'Sueño, rendimiento cognitivo y respuesta autonómica.'},
  eyes:{name:'Ojos',description:'Resultado visual del test Amsler.'},
  head:{name:'Cabeza',description:'Exposición al CO₂ de la cabina.'},
  stomach:{name:'Estómago · hidratación',description:'Ingesta de líquidos, ubicada aquí según el documento.'},
  body:{name:'Cuerpo y huesos',description:'Carga operativa y pérdida de calcio.'},
};
export function classify(metric, raw, values = {}) {
  if (raw === '' || raw === undefined || raw === null) return 'missing';
  if (metric.options) return metric.options.some(([key]) => key === raw) ? raw : 'unknown';
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0 || (metric.max !== undefined && v > metric.max)) return 'invalid';
  switch (metric.id) {
    case 'sleep': return v >= 7.5 ? 'green' : v >= 6 ? 'yellow' : Number(values.sleepDays) >= 3 ? 'red' : 'unknown';
    case 'pvt': return v <= 265 ? 'green' : v < 500 ? 'yellow' : 'red';
    case 'hrv': return v >= 50 ? 'green' : v >= 35 ? 'yellow' : 'red';
    case 'co2': return v < 1500 ? 'green' : v <= 3500 ? 'yellow' : 'red';
    case 'fluids': return v < 1.5 ? 'red' : v < 1.8 ? 'yellow' : v <= 2.5 ? 'green' : 'unknown';
    case 'tlx': return v <= 45 ? 'green' : v < 75 ? 'yellow' : 'red';
    case 'calcium': return v < 250 ? 'green' : v <= 350 ? 'yellow' : 'red';
    case 'radiation': return v < .5 ? 'green' : v <= 1.5 ? 'yellow' : 'red';
    case 'dose': return v < 300 ? 'green' : v <= 479 ? 'yellow' : v >= 600 ? 'red' : 'unknown';
    case 'pressure': return v < 95 ? 'red' : v < 98 ? 'yellow' : v <= 102.5 ? 'green' : 'unknown';
    case 'ventilation': return v < .05 ? 'red' : v < .08 ? 'yellow' : v <= .2 ? 'green' : 'unknown';
    default: return 'unknown';
  }
}
export function summarize(values) {
  const states = metrics.map(m => classify(m,values[m.id],values));
  const scores = {green:100,yellow:50,red:0};
  const known = states.filter(s => s in scores);
  return {score:known.length ? Math.round(known.reduce((sum,s) => sum+scores[s],0)/known.length) : null,
    count:known.length,total:metrics.length,alerts:states.filter(s => s === 'red').length};
}
