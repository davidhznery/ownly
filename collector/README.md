# Ownly · colector Airbnb

**Instalación recomendada del prototipo completo:** [Ownly en Docker](../docker/README.md). Incluye web, datos persistentes y búsquedas programadas. Las instrucciones siguientes describen el colector aislado para la versión Sites.

El panel publicado está en `/admin/airbnb`, protegido por la autenticación de Ownly y `ADMIN_EMAILS`. Los precios se guardan en D1, separados del dataset manual de ocupación. La migración es aditiva. Importar capturas no elimina ningún dato previo.

## Qué funciona sin Docker

**Load verified dataset** importa cinco páginas reales capturadas el 18 de septiembre de 2026: 50 observaciones válidas, 31 de St. Paul's Bay, para 25–27 septiembre, 4 huéspedes y exactamente 2 dormitorios. Mediana 166,50 EUR/noche. El precio por noche es el total anunciado dividido entre dos, no una tarifa base ni ingresos del anfitrión. La importación es idempotente. **Import capture JSON** acepta la salida del colector o una captura individual del mismo esquema. **Search saved data** consulta D1 por localidad y estancia exacta.

## Conectar búsquedas nuevas

El alojamiento de Ownly ejecuta un Worker, no un daemon Docker ni Chromium. El colector necesita un equipo o servidor Docker accesible mediante HTTPS; un dominio propio para Ownly no es necesario.

1. Crear una variable de entorno `MARKET_COLLECTOR_TOKEN` con un secreto aleatorio de al menos 32 caracteres. No guardar el secreto en git.
2. Desde la raíz: `docker compose -f collector/compose.yaml up --build -d`.
3. Publicar el puerto local 8080 mediante un proxy HTTPS. El contenedor solo escucha públicamente a través de ese proxy; `/collect` exige Bearer token. No exponer un proxy abierto.
4. Configurar en los secretos de Sites `MARKET_COLLECTOR_URL=https://<endpoint-del-colector>` y el mismo `MARKET_COLLECTOR_TOKEN`; volver a publicar. El botón **Collect from Airbnb & save** se habilita cuando ambas variables existen. El indicador significa configurado, no una prueba de conectividad.
5. Hacer una búsqueda pequeña (una página). Confirmar el resultado en la tabla y su timestamp. Un error del proveedor o bloqueo de acceso se muestra y nunca se presenta como una búsqueda correcta. Capturas parciales se guardan con advertencia.

El servicio limita una tarea simultánea, cinco páginas y 140 segundos. Lee las tarjetas visibles de Airbnb; no usa API privada, cookies de usuario ni elude verificaciones. El HTML y las medidas del proveedor pueden cambiar. El servicio puede requerir mantenimiento o una fuente autorizada alternativa. La búsqueda utiliza localidad, no un radio geográfico verificado.

## Verificación

`node --test tests/airbnb.test.mjs` (Node 24): muestras reales, filtros exactos, importación repetida en SQLite, precios duplicados de accesibilidad y rechazo de entradas inválidas. Las capturas de prueba están en `lib/airbnb/` y conservan URL y hora de observación. No son precios actuales fuera de ese instante.

El Dockerfile y el contrato HTTP están preparados. La ejecución de Chromium dentro de Docker y la conectividad del servicio desplegado requieren un host Docker; no se consideran verificadas solo por pasar las pruebas de datos. El worker usa el sandbox predeterminado de Playwright; evaluar el aislamiento del contenedor en el host antes de exposición.
