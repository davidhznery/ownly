# Contexto para trabajar en Ownly

## Qué es y dónde empezar

Ownly ayuda a propietarios y subarrendadores de Malta a seguir ingresos, gastos, flujo de caja y proyecciones. Lee `README.md` y, para datos de mercado, `docs/MARKET-DATA.md` y `docs/CHATGPT-MARKET-PROMPTS.md`. Estas instrucciones describen el proyecto; no ejecutan automáticamente una recolección.

## Arquitectura

- `app/`: interfaz React, rutas y API de Next sobre Vinext/Vite.
- `db/`, `drizzle/`: consultas y migraciones aditivas. El runtime Docker aplica migraciones al arrancar.
- `docker/gateway.mjs`, `auth.mjs`, `billing.mjs`, `accounts.mjs`: autenticación, sesiones, Stripe y regalos; es el punto de entrada de producción.
- `docker/runtime.mjs`: Miniflare/workerd y D1 persistente.
- `docker/jobs.mjs`: búsquedas programadas una vez, cada 3 o cada 7 días; cola en SQLite.
- `docker/coverage.mjs`: cobertura por localidades y periodos, con presupuesto diario.
- `collector/`: servicio interno con navegador Playwright. No es la extensión de ChatGPT.
- `lib/airbnb/import.ts`: validación de observaciones JSON de Airbnb/Booking.
- `lib/airbnb/normalize.ts`: validación del formato de capturas del colector.
- `lib/airbnb/locations.mjs` y `lib/localities.ts`: localidades admitidas; no inventar nombres ni confundir Malta y Gozo.

## Reglas al modificar

Usar Node 24 y `npm ci`. Después de cambios ejecutar `npm run lint`, `npm run typecheck`, `npm run build` y `npm test` (las pruebas de integración necesitan el build actual). Mantener las comprobaciones de permisos del propietario y el aislamiento por cuenta. No confiar en cabeceras de identidad enviadas por clientes. No eliminar datos ni el volumen `ownly_data`. No publicar `.env`, credenciales, códigos privados de regalo ni datos de clientes.

Una instalación nueva no hereda datos ni programaciones por clonar Git. Diferenciar servicio saludable, búsquedas habilitadas y ejecuciones recientes exitosas. No afirmar que una búsqueda externa funciona basándose solo en una prueba con datos simulados.

## Recolección con agentes

Usar las instrucciones copiables de `docs/CHATGPT-MARKET-PROMPTS.md` y la extensión conectada por el usuario. No cambiar el colector ni activar nuevas programaciones solo por leer esta guía. Antes de recopilar, tener localidades, fechas futuras, dormitorios y huéspedes definidos. Guardar solo observaciones verificadas y precios totales en céntimos EUR; no convertir precios por noche sin un total confirmado. Mantener IDs como texto y timestamps reales. Si falta un dato obligatorio, omitir la observación y explicar el motivo. Detenerse ante verificaciones o restricciones del sitio. No hacer reservas ni contactar anfitriones.

Para importar, el usuario entra como propietario en `/admin/airbnb`, valida el JSON y después pulsa **Add … observations**. Validar no guarda datos. La recopilación por ChatGPT es un flujo manual independiente de la cola Docker; una conversación no crea una tarea periódica.
