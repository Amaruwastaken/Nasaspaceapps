// Existing schema is documented in Backend/backend.ts. Unmapped metrics stay missing.
export const pendingConnections = ['fluids','gravity','pressure','ventilation','sleepDays','heartRate','dose'];
export async function fetchDatabaseMeasurements(client,userId) {
  const values = {}, dates = {}, warnings = [];
  if (!client || !userId) return {values,dates,warnings};
  const results = await Promise.allSettled([
    client.from('daily_sensor').select('date,rmssd,co2_max,rad_msv').eq('user_id',userId).order('date',{ascending:false}).limit(1),
    client.from('records').select('date,sleep,pvt,tlx').eq('user_id',userId).order('date',{ascending:false}).limit(1),
  ]);
  const mapping = [{hrv:'rmssd',co2:'co2_max',radiation:'rad_msv'},{sleep:'sleep',pvt:'pvt',tlx:'tlx'}];
  results.forEach((result,index) => {
    if (result.status !== 'fulfilled' || result.value.error) { warnings.push(index === 0 ? 'No se pudieron cargar los sensores.' : 'No se pudieron cargar los registros.'); return; }
    const row = result.value.data?.[0];
    if (!row) return;
    for (const [id,column] of Object.entries(mapping[index])) {
      const value = row[column];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) { values[id] = value; dates[id] = row.date; }
    }
  });
  // rad_msv is a daily dose, not lifetime exposure; hr_avg is not resting heart rate.
  return {values,dates,warnings};
}
