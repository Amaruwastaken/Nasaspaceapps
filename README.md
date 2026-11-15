# Nasaspaceapps
nasa space apps lololol
.

## Supabase

Install dependencies with `npm install`, then configure `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` in the environment. `.env.example` lists the
variables; copy it to `.env` for local development. Do not commit `.env`.

The Supabase client is exported from `Backend/backend.ts`. Database-specific
types and queries can be added once the project's schema is defined.

### Registro e inicio de sesión web

Las páginas estáticas de `Interfaz/` usan Supabase Auth. Configura la URL del
proyecto y su publishable key (o `anon` key) en `Interfaz/supabase-config.js`;
esta clave está diseñada para el navegador. Nunca pongas una `service_role`
key en archivos del cliente.

Aplica `supabase/migrations/20261114223000_registry_auth.sql` al proyecto.
Supabase Auth almacena las credenciales; el trigger crea el perfil relacionado
en `public."Registry"` y guarda el nombre en `"Usuario"`. La columna
`"Contraseña"` no se usa para autenticar ni debe contener contraseñas.

### Métricas y reporte

`Interfaz/report-data.js` define las métricas, sus rangos y si son manuales o
automáticas. `captura.html` pregunta únicamente las manuales, una por una, y
guarda esas respuestas localmente por cuenta. `report-source.js` consulta los
indicadores disponibles en `records`, `daily_sensor` y `telemetry`; los que aún
no tienen una columna o conexión quedan como “Sin datos” en el reporte.

### Sistema de emergencia

El reporte suma 2 puntos por cada indicador rojo y 1.25 por cada amarillo
(redondeando el total al entero más cercano). Con un puntaje mayor que 10,
muestra el estado crítico y registra una notificación emergente para todas las
cuentas registradas. Aplica también
`supabase/migrations/20261115020000_health_emergency_notifications.sql`.
Aplica también `supabase/migrations/20261115020300_health_alert_popup.sql` para
que cada cuenta reciba un popup descartable y las alertas no se repitan después
de marcarlas como leídas.
