# Nasaspaceapps

Spanish-language static prototype for astronaut health capture, reporting, and
approximate solar-system mission planning.

## Supabase

Install dependencies with `npm install`. The browser app reads its public
Supabase URL and publishable key from `Interfaz/supabase-config.js`; never put a
service-role key in browser code.

`Backend/backend.ts` provides optional typed Supabase helpers for trusted
server-side scripts. Its `adminClient()` requires `SUPABASE_SERVICE_KEY` and
must never be used in the browser. The static-site build reads its public
configuration from the process environment; Vercel should define
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or the documented aliases).

### Registro e inicio de sesión web

Las páginas estáticas de `Interfaz/` usan Supabase Auth. Configura la URL del
proyecto y su publishable key (o `anon` key) en `Interfaz/supabase-config.js`;
esta clave está diseñada para el navegador. Nunca pongas una `service_role`
key en archivos del cliente.

Aplica `supabase/migrations/20261114223000_registry_auth.sql` al proyecto.
Supabase Auth almacena las credenciales; el trigger crea el perfil relacionado
en `public."Registry"` y guarda el nombre en `"Usuario"`. La columna
`"Contraseña"` no se usa para autenticar ni debe contener contraseñas.
El registro también solicita un rol (capitán, ingeniero, piloto, doctor o
científico) y lo muestra junto al nombre de usuario. En este prototipo, las
cuentas registradas como doctor o capitán pueden consultar los reportes de
todas las cuentas; los datos deben ser ficticios.

### Métricas y reporte

`Interfaz/report-data.js` define las métricas, sus rangos y si son manuales o
automáticas. `captura.html` pregunta únicamente las manuales, una por una, y
guarda esas respuestas en Supabase por cuenta autenticada. `report-source.js`
consulta los indicadores disponibles en `records`, `daily_sensor` y `telemetry`.
Cuando falta un valor, el reporte puede usar `telemetry.simulated_data`; lo
identifica como “Simulado (prototipo)” y no lo utiliza para alertas ni puntajes
de salud.

La vista corporal usa `Interfaz/Imagenes/silueta-cuerpo.jpeg` y solo muestra
regiones con mediciones disponibles.

### Sistema de emergencia

El reporte suma 2 puntos por cada indicador rojo y 1.25 por cada amarillo
(redondeando el total al entero más cercano). Con un puntaje mayor que 10,
registra al tripulante como crítico en Supabase y la interfaz consulta los
estados activos para mostrarlos en un panel inferior izquierdo. Aplica también
`supabase/migrations/20261115020000_health_emergency_notifications.sql`,
`supabase/migrations/20261115020300_health_alert_popup.sql` y
`supabase/migrations/20261115024000_live_health_emergency_panel.sql`.

### Captura conectada a Supabase en Vercel

Proyecto Vercel: nasaspaceapps-farmacias-similunares. El directorio del proyecto es la raiz del repositorio.

- npm run build copia Interfaz a dist y genera la configuracion publica desde SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY. Tambien admite los alias NEXT_PUBLIC_SUPABASE_* y SUPABASE_ANON_KEY. Nunca publica claves service_role ni sb_secret.
- npm test ejecuta los tests de configuracion y persistencia.
- Aplica las migraciones de `supabase/migrations/` en orden en el proyecto Supabase conectado. `20261115040000_unify_measurements_telemetry.sql` elimina únicamente la tabla anterior `manual_measurements` y agrega a `telemetry` el JSON validado de Captura, el JSON de telemetría y una marca de datos simulados.
- `20261115050000_create_user_profiles.sql` completa perfiles faltantes de cuentas Auth existentes y los crea al registrar usuarios nuevos, para que las filas de `telemetry` cumplan su relación con `profiles`. Si no hay una misión en los metadatos de Auth, usa `Farmacias Similunares`.
- `20261115060000_simulate_missing_report_metrics.sql` agrega `telemetry.simulated_data` y completa solo la fila más reciente de cada cuenta. Las capturas nuevas también generan valores de prototipo únicamente para campos omitidos; se etiquetan como simulados y no reemplazan respuestas reales.
- `20261115070000_mission_start_at.sql` agrega una fecha de inicio a `profiles`. La página Misión permite guardarla; el reporte suma radiación diaria solo desde esa fecha y muestra el intervalo usado.
- Captura requiere iniciar sesion y confirma el INSERT antes de abrir Reporte. Si falla, mantiene las respuestas en la pagina; no simula un guardado local.
- Cada envío de Captura agrega una sola fila a `telemetry`: incluye las respuestas manuales y una lectura automática genérica marcada como simulada. Las lecturas automáticas existentes pueden seguir usando las columnas de sensores; `manual_measurements` queda en `NULL` para esas filas.
- Reporte consulta la última captura de `telemetry`. Una prueba omitida en esa captura no se reemplaza por un valor antiguo de `records`. Los sensores y las alertas existentes mantienen sus conexiones actuales.
- Los datos antiguos de localStorage no se importan automaticamente: ya no son la fuente del reporte.

La migración no reemplaza las tablas existentes `records`, `daily_sensor`, `telemetry` o `Registry`; requiere que estén configuradas junto con las migraciones anteriores. La migración nueva solo elimina la tabla anterior `manual_measurements` y amplía `telemetry`. En un Supabase totalmente nuevo hay que configurar el esquema base antes de activar sensores y alertas.

### Panel del doctor y capitán

`Interfaz/doctor.html` permite seleccionar integrantes y consultar sus
indicadores, pruebas de Captura e historial de registros y sensores. El panel es
de consulta; las capturas y alertas personales conservan su flujo habitual.

Aplicar en orden las migraciones `20261115070000_mission_start_at.sql`,
`20261115080000_ensure_core_schema.sql`,
`20261115090000_mission_medical_access.sql` y
`20261115100000_demo_doctor_signup_access.sql` (en proyectos conectados, usar
`supabase db push`). La última migración permite que el rol doctor o capitán
seleccionado durante el registro habilite el acceso de lectura a todos los
reportes de esta instancia.

**No usar con datos reales.** Cualquier persona puede registrarse como doctor o
capitán y consultar los datos de las demás cuentas; el aviso correspondiente
también aparece en `doctor.html`. La vista `daily_sensor` aplica las políticas
de sus tablas de origen.
