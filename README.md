# Ownly

Aplicación para propietarios y subarrendadores en Malta: ingresos, gastos, hipotecas, rentabilidad, proyecciones y precios de mercado. Incluye acceso por correo o Google, suscripciones Stripe, cuentas de regalo y administración de observaciones de Airbnb y Booking.

## Arrancar en otra computadora

Necesitas Git y Docker Desktop en funcionamiento. Para desarrollar sin instalar Node localmente puedes compilar y ejecutar mediante Docker. Para los comandos de desarrollo y pruebas usa Node **24** (la misma versión principal que los contenedores).

```powershell
git clone https://github.com/davidhznery/ownly.git
cd ownly
powershell -ExecutionPolicy Bypass -File docker/setup.ps1
```

En macOS/Linux: `bash docker/setup.sh`. El asistente crea `.env` si no existe y arranca los servicios. Abre http://localhost:3001 y entra con el propietario configurado. Si ya tienes tu configuración, copia `.env` por un medio privado antes de arrancar. Consulta [la guía Docker](docker/README.md) para Google, Stripe, correo, publicación y copias de seguridad.

**GitHub transporta el código, no los datos de Docker.** Las cuentas, propiedades, precios y programaciones viven en el volumen `ownly_data` de Compose (Docker puede mostrarlo con el prefijo del proyecto). Para conservarlos en otra máquina necesitas una copia del volumen además de `.env`. No ejecutes `docker compose down -v` sobre una instalación que quieras conservar.

## Trabajar y comprobar cambios

```powershell
git pull origin main
npm ci
npm run lint
npm run typecheck
npm run build
npm test
```

Ejecuta `build` antes de las pruebas de integración: usan `dist/server` y `dist/client`. Los scripts de prueba habilitan la carga de TypeScript necesaria en Node 22. Para el entorno soportado y reproducible usa Node 24. `npm run dev` sirve para la interfaz; el acceso real de clientes, Stripe y la cola de colección se prueban con Docker.

Para aplicar cambios a la web local conservando sus datos:

```powershell
docker compose up -d --build --no-deps web
```

Si cambias el colector, reconstruye también `collector`. No subas `.env`, contraseñas, tokens, datos de clientes ni copias del volumen.

## Documentación

- [Colectores, estado revisado y programación cada 3 días](docs/MARKET-DATA.md).
- [Instrucciones listas para ChatGPT + extensión del navegador y JSON](docs/CHATGPT-MARKET-PROMPTS.md).
- [Contexto e instrucciones para agentes que trabajen en el repositorio](AGENTS.md).
- [Importación de observaciones](docker/IMPORT-OBSERVATIONS.md) y [datos de Booking](docker/BOOKING-IMPORT.md).
- [Plan de cobertura continua](docker/CONTINUOUS-MARKET.md).
- [Códigos de referencia: 10 cuentas, 30 días de Portfolio](docker/REFERENCE-CODES.md).
- [Instalación y operación de Docker](docker/README.md).

Los precios de mercado son observaciones de precios anunciados para huéspedes y fechas concretas. No demuestran ocupación, ingresos reales ni rentabilidad futura.
