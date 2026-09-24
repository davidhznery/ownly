# Ownly Malta en Docker

## Qué incluye

Un solo `docker compose` arranca la web completa de Ownly, la base de datos persistente, el programador de búsquedas y el colector Airbnb. No requiere contratar una API, comprar dominio ni alojar la web en Sites. El ordenador debe permanecer encendido, con Internet y Docker funcionando. Cerrar el navegador no detiene las búsquedas.

La web admite cuentas de clientes y cobros recurrentes por Stripe al configurar las claves. Cada cliente tiene un identificador separado para sus datos. El runtime usa Miniflare local; no es un servicio Cloudflare D1 gestionado.

## Primer arranque en Windows

1. Instalar y abrir Docker Desktop con contenedores Linux.
2. Descomprimir el proyecto completo. Abrir PowerShell en esa carpeta.
3. Ejecutar `./docker/setup.ps1`.
4. Introducir tu correo. El script genera una contraseña y la muestra una sola vez; conservarla. También queda en el archivo local `.env`, que nunca debes compartir.
5. Esperar a que termine la primera compilación. Abrir http://localhost:3001/admin/airbnb e iniciar sesión en el formulario de Ownly con ese correo y contraseña.

En Linux o macOS: `bash docker/setup.sh`.

Arranques posteriores: `docker compose up -d`. Estado: `docker compose ps`. Registros: `docker compose logs --tail=100 web collector`. Detener sin borrar datos: `docker compose stop`. Para volver a compilar una actualización: `docker compose up --build -d`.

## Tu única operación habitual

En el panel, introducir zona, dormitorios, huéspedes, entrada, salida y número de páginas. En **Automatic searches**, elegir **Once**, **Every 3 days** o **Every 7 days**, y pulsar **Save search & start**. La primera ejecución empieza enseguida. Cada trabajo muestra estado y observaciones añadidas. Los datos aparecen automáticamente; también existe **Refresh saved prices**.

Las recurrencias desplazan las fechas para conservar la antelación inicial y la duración de la estancia. Ejemplo: al crear el día 22 una búsqueda para 25–27, la ejecución del día 25 buscará 28–30. Se puede pausar/reanudar. Si el equipo estuvo apagado, al encender se recuperan los trabajos interrumpidos y se lanza una ejecución vencida por búsqueda, sin reproducir todas las repeticiones perdidas.

Los fallos transitorios se reintentan hasta tres veces. Si Airbnb exige verificación o bloquea el acceso, el trabajo se detiene y muestra el error; no intenta eludir el bloqueo. Que la programación funcione no garantiza que Airbnb permita cada captura ni que su HTML permanezca igual.

## Stripe y pagos

### Cuenta obligatoria y acceso

El servidor Docker es la entrada pública de Ownly. El flujo es: `/register`
(Google o correo y contraseña) → `/onboarding` (plan) → Stripe Checkout →
confirmación por webhook → `/dashboard`. Crear una cuenta no inicia la prueba;
Stripe fija sus fechas al activar la primera suscripción. No hay acceso anónimo
al panel ni a las API privadas. Una cuenta pendiente, vencida o con pago fallido
puede iniciar sesión y gestionar su facturación, pero no usar el producto.
La prueba se concede una vez por cuenta; las renovaciones tras una cancelación
no reciben otra prueba. Los datos y sesiones de las cuentas existentes se conservan.

El gateway se ejecuta con `docker compose up --build -d web`. `npm run dev`
solo levanta la aplicación interna y no sirve el acceso Google/correo ni Stripe.
No publiques el runtime interno directamente: la autenticación se aplica en
`docker/gateway.mjs`, que elimina las cabeceras de identidad enviadas por el cliente.

### Inicio de sesión con Google

1. En Google Cloud / Google Auth Platform, configura la audiencia, los datos de
   marca y un cliente OAuth de tipo **Web application**. Durante el modo de
   pruebas, añade las cuentas que podrán iniciar sesión como usuarios de prueba.
2. Registra exactamente la URI de redirección de tu entorno:
   `http://localhost:3001/auth/google/callback` para desarrollo y
   `https://ownlymalta.com/auth/google/callback` para ese dominio en producción.
   Usa clientes separados para desarrollo y producción.
3. Añade `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` al `.env` local del servidor,
   y verifica que `PUBLIC_ORIGIN` coincide con el origen público. No subas secretos
   al repositorio. Reconstruye el servicio web.
4. El botón Google aparece cuando ambas variables están presentes. Sin ellas,
   el registro por correo funciona y no aparece un botón inoperante.

Solo se solicitan `openid email profile`. La biblioteca oficial de Google
verifica la firma, emisor, caducidad y audiencia del ID token; Ownly comprueba
además el correo verificado, nonce, estado de un solo uso y cookie del navegador.
El código usa PKCE. No almacena tokens de acceso ni de actualización de Google.
Si ya existe una cuenta con ese correo, primero hay que entrar con contraseña y
elegir **Connect Google** en `/account/access`; nunca se unen cuentas por correo
sin autenticar al titular de la cuenta existente. El propietario conserva su
acceso administrativo mediante correo y contraseña.

Prueba local de los flujos y controles de acceso: `npm run test:auth`. Se usan
dobles únicamente para Google, Stripe y el runtime de la aplicación; no se
crean cobros ni cuentas externas. La validación real requiere credenciales de
Google y un sandbox Stripe configurado, incluyendo el webhook.

Para las pruebas completas del runtime, usa Node 24 (la versión del Dockerfile).
Con Node 22.17, ejecuta `npm run test:docker` con
`NODE_OPTIONS=--experimental-strip-types` para los módulos TypeScript existentes.

Referencia: https://developers.google.com/identity/protocols/oauth2/web-server

El almacén de cuentas y el estado temporal OAuth pertenecen a una instancia
del servidor con el volumen persistente `/data`; esta configuración no admite
varias réplicas concurrentes compartiendo `accounts.json`. Reiniciar el servidor
durante un acceso Google obliga a repetir ese acceso. El correo y contraseña
no incluyen todavía verificación de correo ni recuperación automática de contraseña.

1. Stripe Checkout con Billing gestiona el pago inicial, la prueba y las renovaciones; el portal permite cancelar y actualizar la tarjeta.
2. Para desarrollo, usa un sandbox separado. Crea una clave restringida de prueba con Checkout Sessions (lectura/escritura), Subscriptions (lectura) y Billing Portal Sessions (escritura). Guarda la clave rk_test en el archivo .env local, que no se sube a git.
3. Crea dos productos y un precio mensual recurrente por producto: Individual €9 y Portfolio €25. Configura sus Price IDs en STRIPE_INDIVIDUAL_PRICE_ID y STRIPE_PORTFOLIO_PRICE_ID.
4. Configura webhooks hacia https://ownlymalta.com/stripe/webhook: checkout.session.completed, checkout.session.async_payment_succeeded, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.paid e invoice.payment_failed. Guarda el secreto whsec en .env como STRIPE_WEBHOOK_SECRET. Los webhooks reflejan renovaciones, fallos y cancelaciones.
5. Activa el portal de clientes en Stripe. Añade la clave de API y las claves de precio al .env; confirma PUBLIC_ORIGIN=https://ownlymalta.com y reconstruye con docker compose up --build -d web.

La prueba dura 7 días y solicita tarjeta. Stripe cobra €9 o €25 al terminarla si el cliente no cancela. Mantén el sandbox mientras se prueba. Antes de cobrar en producción, verifica la cuenta comercial y configura claves y webhooks live. Para IVA en Malta o la UE, consulta con tu asesor fiscal qué registros necesita la empresa antes de activar Stripe Tax; Stripe no recauda en jurisdicciones sin un registro activo.

## Datos y acceso

- Los datos y trabajos se guardan en el volumen `ownly_data`; sobreviven a reinicios y reconstrucciones.
- No ejecutar `docker compose down -v`: elimina el volumen.
- El colector no expone puertos al ordenador; solo la web puede llamarlo por la red interna.
- La web escucha únicamente en `127.0.0.1:3001`. Para acceso desde Internet hace falta desplegar en un host y poner HTTPS delante, con `PUBLIC_ORIGIN` coherente.
- El acceso privado usa una sesión de siete días en una cookie HttpOnly. La contraseña anterior de `.env` sigue siendo válida; la autenticación HTTP básica se conserva para clientes automatizados.
- Las bases de datos de Docker y de la página actual en Sites son independientes. Este paquete no copia automáticamente propiedades ni registros privados de Sites. Las capturas verificadas se pueden cargar desde el botón correspondiente.
- Conservar `.env` y realizar copias del volumen antes de migrar a un servidor.

## Validación realizada

- Compilación y TypeScript.
- Normalización de cinco páginas reales: 50 observaciones válidas y 31 coincidencias para St. Paul's Bay.
- Programación, fechas móviles, pausa/reanudación, reintentos y persistencia de trabajos.
- Worker real y base D1 local: cola → importación → consulta → reinicio → misma información.
- Acceso HTTP con contraseña, rechazo de cabeceras de identidad falsas, protección de origen, carga de la web/estilos y guardado automático por el servicio.

Actualización local del 22 de septiembre de 2026: TypeScript y 10 pruebas automatizadas correctas; compilación Docker realizada y servicios saludables. Se verificó crear, consultar y editar un subarriendo sin precio, y se eliminó el registro temporal conservando los datos existentes.

Comandos de prueba, desde el proyecto con Node 24 y dependencias instaladas:

```
npm run build
npx tsc --noEmit
node --test tests/airbnb*.test.mjs tests/docker-*.test.mjs
```

En entornos con proxy que también intercepte loopback, excluir `localhost` y `127.0.0.1` para las pruebas locales.

Referencias del runtime: https://developers.cloudflare.com/workers/testing/miniflare/ y https://playwright.dev/docs/docker .
