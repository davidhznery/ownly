# Plan de cobertura de Local market

Para la cobertura continua por quincenas, utiliza el nuevo panel **Continuous Malta coverage** y consulta [CONTINUOUS-MARKET.md](CONTINUOUS-MARKET.md). Este script sigue siendo una alternativa manual de 24 búsquedas con fechas concretas; no es necesario aplicarlo además del plan continuo.

Desde la carpeta del proyecto, con Node 24:

```powershell
node docker/market-plan.mjs
```

Con Node 22.17 instalado actualmente, añade `--experimental-strip-types` después de `node` en ambos comandos.

Previsualiza 24 búsquedas: las cuatro localidades admitidas, 1–3 dormitorios y estancias de tres noches a 14 y 60 días. Cada búsqueda admite hasta cinco páginas. No consulta Airbnb ni modifica Ownly durante la previsualización.

Para registrar el plan en el programador existente:

```powershell
node docker/market-plan.mjs --apply
```

Este comando lee las credenciales de `.env` y las envía únicamente al servicio local en 127.0.0.1:3001. Docker debe estar disponible. Registra las búsquedas para ejecución inmediata y repetición semanal; las fechas avanzan automáticamente. Omite las búsquedas activas con los mismos parámetros y comprueba el límite de 30 antes de empezar. Cambiar de día cambia las fechas del plan; revisa las búsquedas existentes antes de volver a aplicarlo. No ejecutarlo simultáneamente desde varias terminales.

El recolector procesa una búsqueda cada vez. Cinco páginas es un máximo, no una garantía de resultados. Revisa estados y errores en `/admin/airbnb`; no confundir capturas vacías o bloqueadas con éxito. El recolector se detiene ante verificaciones o restricciones de acceso.

Antes de programar extracción de una fuente, confirma el permiso de uso. Airbnb restringe la recolección automatizada en sus términos. Booking Demand API necesita acceso de socio y condiciones compatibles con el análisis previsto. Este plan reutiliza la implementación existente y no incorpora Booking.

Las tarifas son precios anunciados para unas fechas y huéspedes concretos. No miden ocupación real ni ingresos del anfitrión. Para estimar el mercado, conviene diversificar las fechas y conservar fuente, fecha de observación, moneda y tamaño de muestra. Las 24 búsquedas no garantizan cobertura de toda Malta. La consulta actual conserva la observación más reciente por anuncio dentro del mes elegido; no constituye todavía un histórico de evolución de tarifas.
