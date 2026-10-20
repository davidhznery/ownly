# Cobertura continua de Malta y Gozo

El administrador puede ver y pausar el plan en `/admin/airbnb`, en **Continuous Malta coverage**. El programador funciona en Docker aunque el navegador esté cerrado. Necesita el equipo, Docker y la conexión activos.

## Plan inicial

- Diez localidades prioritarias: St. Paul's Bay, Sliema, St. Julian's, Valletta, Mellieħa, Gżira, Msida, Swieqi, Marsaskala y Rabat (Gozo). Es una selección inicial, no un ranking verificado de búsquedas.
- Dos dormitorios, cuatro huéspedes y estancias representativas de tres noches.
- Dos quincenas disponibles: 1–15 y 16–fin de mes. Al avanzar la fecha, avanza el horizonte y se descartan tareas pendientes con estancias pasadas. No se recopilan precios históricos.
- Hasta dos páginas por búsqueda y veinte búsquedas nuevas por 24 horas. Una búsqueda a la vez, con al menos treinta segundos entre trabajos de cobertura.
- Muestras positivas renovadas después de siete días. Zonas sin coincidencias después de catorce días; fallos transitorios hasta tres intentos. Las restricciones de acceso suspenden toda la cobertura durante 24 horas, sin eludirlas.
- Tras siete días, se incluyen las 68 localidades. También se puede ampliar antes desde el panel. La actualización semanal es un objetivo, no una garantía de cobertura ni de resultados.

El presupuesto cuenta trabajos nuevos, no reintentos ni búsquedas manuales independientes. Las tareas y configuración se conservan en `jobs.sqlite`. Las observaciones se conservan en la base existente; no se borran al actualizar el servicio.

Antes de recopilar, una comprobación diaria reutiliza también los datos existentes: una quincena con al menos cinco apartamentos coincidentes, observados durante los últimos siete días, aparece como `cached` y no necesita una búsqueda nueva. El requisito de cinco no garantiza representatividad estadística; solo es el umbral inicial para ahorrar capturas. Las casas pueden seguir consultándose por separado.

## Consulta y reutilización

En **Local market**, el mes funciona como antes. Se puede introducir **From / To**: 2–12 y 12–15 de octubre reutilizan las observaciones de la quincena 1–15. Un rango que cruza quincenas usa ambas. Consultar no lanza capturas. Se conserva la observación más reciente por anuncio y se filtran localidad, habitaciones, tipo y huéspedes. Condominios y apartamentos se agrupan; casas incluyen Home. Se muestra la fecha de observación y se señala si hay muestras de más de siete días.

Este resumen representa anuncios para estancias muestreadas, **no** el precio exacto de cualquier estancia en el rango. Los huéspedes y la duración afectan los precios; dividir el total entre noches no elimina esos efectos. No se infiere ocupación ni alquileres cerrados.

Los resultados de zonas vecinas se guardan con su localidad real y no cuentan como coincidencias de la zona solicitada. Añadir 68 localidades al programador no garantiza que la fuente entregue anuncios en cada una; el panel diferencia muestras, ausencia de coincidencias y errores.

## Despliegue local

```powershell
docker compose build web collector
docker compose up -d web collector
```

No ejecutar `docker compose down -v`. La configuración es aditiva. Activar el plan desde el panel después de verificar ambos servicios.

La integración reutiliza el recolector existente. Las condiciones de uso de la fuente y cambios de HTML afectan su continuidad. No incluye una nueva fuente Booking ni un proveedor comercial.
