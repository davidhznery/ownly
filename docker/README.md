# Ownly en Docker — prototipo privado

## Qué incluye

Un solo `docker compose` arranca la web completa de Ownly, la base de datos persistente, el programador de búsquedas y el colector Airbnb. No requiere contratar una API, comprar dominio ni alojar la web en Sites. El ordenador debe permanecer encendido, con Internet y Docker funcionando. Cerrar el navegador no detiene las búsquedas.

Esta instalación es privada y para el propietario, con contraseña. No es todavía una plataforma multiusuario preparada para clientes. La web conserva el mismo código del proyecto actual. Para ejecutar su Worker fuera de Sites se usa workerd mediante Miniflare; es una solución de prototipo/local, no un servicio Cloudflare D1 gestionado.

## Primer arranque en Windows

1. Instalar y abrir Docker Desktop con contenedores Linux.
2. Descomprimir el proyecto completo. Abrir PowerShell en esa carpeta.
3. Ejecutar `./docker/setup.ps1`.
4. Introducir tu correo. El script genera una contraseña y la muestra una sola vez; conservarla. También queda en el archivo local `.env`, que nunca debes compartir.
5. Esperar a que termine la primera compilación. Abrir http://localhost:3001/admin/airbnb e iniciar sesión con ese correo y contraseña.

En Linux o macOS: `bash docker/setup.sh`.

Arranques posteriores: `docker compose up -d`. Estado: `docker compose ps`. Registros: `docker compose logs --tail=100 web collector`. Detener sin borrar datos: `docker compose stop`. Para volver a compilar una actualización: `docker compose up --build -d`.

## Tu única operación habitual

En el panel, introducir zona, dormitorios, huéspedes, entrada, salida y número de páginas. En **Automatic searches**, elegir **Once**, **Every 3 days** o **Every 7 days**, y pulsar **Save search & start**. La primera ejecución empieza enseguida. Cada trabajo muestra estado y observaciones añadidas. Los datos aparecen automáticamente; también existe **Refresh saved prices**.

Las recurrencias desplazan las fechas para conservar la antelación inicial y la duración de la estancia. Ejemplo: al crear el día 22 una búsqueda para 25–27, la ejecución del día 25 buscará 28–30. Se puede pausar/reanudar. Si el equipo estuvo apagado, al encender se recuperan los trabajos interrumpidos y se lanza una ejecución vencida por búsqueda, sin reproducir todas las repeticiones perdidas.

Los fallos transitorios se reintentan hasta tres veces. Si Airbnb exige verificación o bloquea el acceso, el trabajo se detiene y muestra el error; no intenta eludir el bloqueo. Que la programación funcione no garantiza que Airbnb permita cada captura ni que su HTML permanezca igual.

## Datos y acceso

- Los datos y trabajos se guardan en el volumen `ownly_data`; sobreviven a reinicios y reconstrucciones.
- No ejecutar `docker compose down -v`: elimina el volumen.
- El colector no expone puertos al ordenador; solo la web puede llamarlo por la red interna.
- La web escucha únicamente en `127.0.0.1:3001`. Para acceso desde Internet hace falta desplegar en un host y poner HTTPS delante, con `PUBLIC_ORIGIN` coherente.
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
