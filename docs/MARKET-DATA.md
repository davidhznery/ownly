# Datos de mercado: cómo funciona Ownly

## Dos formas de alimentar la misma base

1. **Automática con Docker:** `web` mantiene una cola; llama al servicio interno `collector`, que abre Airbnb con Playwright, extrae las tarjetas visibles y devuelve capturas. La API de administración valida y guarda las observaciones.
2. **Asistida con ChatGPT:** el usuario da una instrucción al agente conectado a su navegador mediante la extensión, el agente verifica anuncios y entrega un JSON de observaciones. El propietario valida y carga el archivo en Ownly. No hace falta que el colector automático funcione para importar archivos.

La segunda vía reproduce el procedimiento descrito por el propietario del proyecto. Los prompts de esta guía son una versión reproducible de ese flujo, no una transcripción literal de conversaciones antiguas.

## Estado comprobado en la instalación local el 20 de octubre de 2026

Se consultaron los servicios y la base de la cola en modo lectura, sin lanzar búsquedas nuevas:

- Servicios `web` y `collector` funcionando con estado saludable.
- Plan de cobertura **habilitado**, alcance inicial `priority`, expansión tras 7 días, presupuesto de 20 búsquedas diarias, 2 páginas, 2 dormitorios y 4 huéspedes.
- Renovación de muestras: 7 días; 2 periodos quincenales próximos.
- Última ejecución consultada: `2026-10-20T08:04:30.108Z`, Isla, completada con 16 observaciones insertadas. Las dos anteriores también terminaron correctamente.
- Histórico consultado: 61 ejecuciones completadas, 11 vacías y 17 canceladas.
- Cuatro búsquedas individuales antiguas de una sola ejecución; ninguna búsqueda individual recurrente habilitada cada 3 días.

Es una fotografía de esta instalación, no un estado garantizado para el futuro ni una configuración que GitHub replique. No se modificó la frecuencia existente. La cola mantiene su configuración en el volumen local.

## Programar una búsqueda cada 3 días

1. Mantener Docker y la computadora/servidor encendidos.
2. Entrar como propietario en `/admin/airbnb`.
3. Elegir localidad, dormitorios, huéspedes, fechas futuras y páginas en **Define your comparison**.
4. En **Automatic searches**, seleccionar **Every 3 days** y pulsar **Save search & start**.
5. Se encola una ejecución inicial. Revisar la tabla de resultados, `status`, `Saved` y cualquier error. Después se repetirá aproximadamente cada tres días mientras el servicio está activo.
6. **Pause** detiene futuras repeticiones y cancela lo pendiente de esa búsqueda; **Resume** la vuelve a habilitar. **Run now** solicita otra ejecución. No crear duplicados si ya existe la búsqueda deseada.

Las fechas de estancia avanzan con el tiempo conservando la antelación y el número de noches iniciales. No significa consultar para siempre las mismas fechas. La cola se revisa cada 2 segundos; un servicio apagado o una ejecución en curso puede retrasar el inicio. Cerrar el navegador no detiene Docker, pero apagar/suspender la máquina sí interrumpe el trabajo.

El plan **Market coverage** es distinto: recorre localidades y quincenas con su propio presupuesto y frecuencia de renovación. Su configuración actual no equivale a una búsqueda individual cada 3 días. Consulta `docker/CONTINUOUS-MARKET.md`.

## Comprobar si funciona

```powershell
docker compose ps
docker compose logs --tail 80 web collector
```

Después abre **Automatic searches** y **Market coverage** en la administración. Un `/health` saludable solo indica que responde el servicio. La evidencia de extracción efectiva son ejecuciones recientes `completed`/`partial`, observaciones insertadas y fechas de observación recientes.

Estados: `queued` espera; `running` está trabajando; `completed` terminó; `partial` conserva resultados parciales y muestra errores; `empty` no tuvo coincidencias útiles; `failed` agotó reintentos o sufrió una restricción; `cancelled` fue cancelada. Errores transitorios se reintentan hasta tres intentos, con esperas crecientes. El colector no intenta eludir verificaciones. La cobertura espera tras detectar restricciones.

Si falla: revisar errores, verificar fechas y filtros, comprobar la página y usar el flujo manual de JSON. No confundir un cambio de diseño de Airbnb con ausencia de alojamientos.

## Importar JSON recogido por un agente

1. Abrir `/admin/airbnb` como propietario.
2. Ir a **Expand your market data now**.
3. **Download JSON template** descarga una plantilla de observaciones. Reemplazar los ejemplos con datos reales; no importar ejemplos.
4. **Validate JSON file** selecciona y valida el archivo. Límite del archivo de la interfaz: 1,9 MB; máximo 1.000 observaciones. Todos los precios deben estar en EUR.
5. Revisar el número aceptado y las advertencias. Validar todavía no guarda.
6. **Add … observations** guarda. Revisar la cobertura y buscar usando los mismos filtros.

Los archivos modernos usan `observations`; las capturas del colector usan `captures` y se cargan por el importador de capturas, no como observaciones. No intercambiar los formatos. El proveedor se declara a nivel del archivo; separar Airbnb y Booking en archivos distintos.

La identidad de una observación incluye anuncio, estancia, huéspedes y momento de observación (además del proveedor para Booking). Importar exactamente la misma observación no la duplica. Una observación nueva de otro día sí puede guardarse: es historial válido. El mismo alojamiento anunciado en dos plataformas no se deduplica como inmueble físico.

Las observaciones marcadas para revisión se guardan, aparecen en administración y se excluyen de promedios. Las comparaciones usan filtros de localidad, dormitorios, huéspedes, tipo y periodo. Algunos resultados reutilizan muestras quincenales; no son cotizaciones para cualquier fecha ni prueban ocupación.

## Persistencia y réplica

En `/data` se guardan `jobs.sqlite` (búsquedas, ejecuciones y cobertura), `accounts.json` (cuentas y regalos) y `d1/` (propiedades y observaciones). Compose persiste ese directorio en `ownly_data`. El repositorio contiene migraciones y código; no contiene una copia de esos datos ni programa automáticamente el colector en una máquina nueva.

Para replicar el procedimiento, seguir `README.md`, configurar la instalación propia y crear sus búsquedas. Para trasladar una instalación existente, conservar `.env` privadamente y hacer una copia consistente del volumen con los servicios detenidos. No copiar SQLite en plena escritura ni borrar volúmenes existentes.
