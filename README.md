# Ownly

Proyecto unificado en C:\Users\admin\Downloads\ownly-docker.

La actualización Local Market ya está integrada, incluidos los filtros y el resumen de precios más recientes. No hay que copiar archivos de otro proyecto.

Inicio: docker compose up --build -d

Web: http://localhost:3001

Se conserva .env y el volumen de Docker ownly_ownly_data. No ejecutar docker compose down -v.

Las propiedades permiten propietario o subarriendo. En subarriendo se descuenta el alquiler pagado al propietario y no se calcula patrimonio inmobiliario. Precios y valoraciones son opcionales. Market Pro conserva el acceso durante la prueba y las estimaciones usan los comparables disponibles; aún no hay una integración nueva con agencias ni filtro por metros cuadrados.
