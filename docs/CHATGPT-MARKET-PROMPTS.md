# Recopilar Airbnb con ChatGPT y cargar JSON en Ownly

## Preparar el navegador

Necesitas una versión de ChatGPT de escritorio con control de navegador disponible. En **Settings > Computer Use**, selecciona tu navegador, instala el plugin/extensión indicado y verifica que figure conectado (**Manage**). Usa el mismo perfil del navegador y selecciona `@Chrome` o `@Edge` en el chat. También puedes adjuntar una pestaña abierta. La disponibilidad depende de tu aplicación y espacio de trabajo.

Estas indicaciones se contrastaron el 20 de octubre de 2026 con la [documentación oficial de la extensión](https://learn.chatgpt.com/docs/chrome-extension) y la [guía oficial de navegador](https://developers.openai.com/training/walkthroughs/using-your-computer-and-browser). Si cambian los menús, seguir esas fuentes. La extensión conecta el navegador; no existe en Ownly un botón que active ChatGPT dentro de Airbnb.

El colector Docker y la extensión son sistemas independientes. Los prompts siguientes son instrucciones manuales; no crean una tarea automática cada 3 días. Selecciona el navegador en el menú de menciones antes de enviar el texto.

## Prompt de recolección: copiar y completar

Sustituye los campos entre corchetes, en particular ambas fechas futuras. Si quieres varias localidades, usa sus nombres tal como aparecen en el selector de Ownly o en `lib/airbnb/locations.mjs`. Para empezar puedes usar Sliema. Los dormitorios deben ser exactos; un filtro de Airbnb que diga "2+" no acredita que cada anuncio tenga exactamente 2.

```text
@Chrome Quiero recopilar observaciones reales de Airbnb para Ownly.
Usa exclusivamente el navegador conectado mediante la extensión para consultar Airbnb; no uses APIs privadas, peticiones directas ni un colector alternativo. Puedes crear el archivo local de salida con los datos observados.

Parámetros:
- Localidades: [Sliema u otra lista de localidades admitidas por Ownly].
- Entrada: [YYYY-MM-DD futura].
- Salida: [YYYY-MM-DD posterior; estancia de 1 a 90 noches].
- Huéspedes adultos: 4.
- Dormitorios exactos: 2.
- Tipo: apartamento completo; excluye habitaciones, hoteles y alojamientos de otro tipo.
- Moneda: EUR.
- Máximo: 2 páginas de resultados por localidad y 50 observaciones en este lote.

Entra en Airbnb, aplica esos filtros y verifica en la interfaz las fechas, huéspedes, dormitorios exactos, tipo y localidad de cada anuncio que incluyas. No atribuyas la localidad buscada a todos los resultados: Airbnb puede mostrar localidades cercanas. Separa Malta y Gozo. Si un dato obligatorio no se puede comprobar, omite ese anuncio y explica el motivo fuera del JSON.

Registra el total anunciado de toda la estancia, en céntimos EUR como entero, no solo la tarifa por noche. No inventes impuestos ni cargos ni reconstruyas totales ambiguos. Conserva ID como texto, nombre real, enlace canónico sin parámetros y momento real de observación ISO 8601 con zona horaria. No cambies una fecha de observación para aparentar frescura. No hagas reservas ni contactes anfitriones. Ante CAPTCHA, verificación o restricción, detente y explica dónde ocurrió; no intentes eludirla.

Entrega un archivo ownly-airbnb-YYYY-MM-DD.json siguiendo exactamente el contrato Airbnb de esta guía: provider="airbnb", schema_version=1, currency="EUR", observations=[...]. No incluyas observaciones ficticias ni ejemplos. No repitas el mismo anuncio para las mismas fechas y huéspedes dentro del lote. Usa property_type="apartment" solo si lo comprobaste.

Fuera del JSON resume localidades revisadas, páginas visitadas, cantidad incluida, omisiones y limitaciones. Si no obtienes observaciones válidas, informa el motivo y no presentes un archivo vacío como importación válida. No lo cargues todavía en Ownly.
```

## Contrato del JSON Airbnb

Este ejemplo explica los campos y es una **plantilla no importable**: sustituye todos los marcadores con evidencias reales. El importador rechaza IDs y fechas de ejemplo. En cada archivo todas las observaciones pertenecen al proveedor declarado.

```json
{
  "provider": "airbnb",
  "schema_version": 1,
  "currency": "EUR",
  "observations": [
    {
      "listing_id": "REEMPLAZAR_POR_ID_NUMERICO_REAL",
      "name": "REEMPLAZAR_POR_NOMBRE_REAL",
      "url": "https://www.airbnb.com/rooms/REEMPLAZAR_POR_ID_NUMERICO_REAL",
      "locality": "Sliema",
      "property_type": "apartment",
      "bedrooms": 2,
      "adults": 4,
      "checkin": "YYYY-MM-DD",
      "checkout": "YYYY-MM-DD",
      "total_cents": 0,
      "observed_at": "YYYY-MM-DDTHH:mm:ssZ"
    }
  ]
}
```

| Campo | Regla |
| --- | --- |
| `listing_id` | Cadena de 1 a 25 dígitos para Airbnb. Nunca número JSON. |
| `name` | Nombre real, 1–250 caracteres. |
| `url` | HTTPS canónico en `www.airbnb.com` o `www.airbnb.com.mt`, ruta `/rooms/ID` coincidente. |
| `locality` | Localidad admitida; usar los nombres del selector o plantilla de Ownly. |
| `property_type` | El validador admite `apartment`, `condo`, `condominium`, `rental unit`, `house`, `home`, `villa`, `room`. El prompt de arriba restringe el lote a apartamentos completos. |
| `bedrooms` | Entero de 1 a 10, comprobado para el anuncio. |
| `adults` | Entero de 1 a 16, del precio observado. |
| `checkin`, `checkout` | Fechas reales `YYYY-MM-DD`, estancia de 1–90 noches. Para recopilar precios actuales usar fechas futuras. |
| `total_cents` | Entero positivo del total anunciado en EUR: 450,00 EUR se escribe `45000`. Máximo 100000000. |
| `observed_at` | Momento real con zona horaria, por ejemplo formato UTC terminado en `Z`; nunca una fecha futura. |

La validación de filas la implementa `lib/airbnb/import.ts`; consultar esa fuente si cambia el contrato. `nights` se calcula a partir de las fechas: no necesitas inventar ni enviar una media por noche. El máximo por archivo es 1.000 observaciones; la interfaz limita el tamaño a 1,9 MB.

Para Booking usar un archivo separado con `provider="booking"`, `schema_version=1` y los campos adicionales obligatorios descritos en [BOOKING-IMPORT.md](../docker/BOOKING-IMPORT.md) y el validador: `unit_name`, `address`, `units=1`, `taxes_included` (booleano o null), `additional_charges_text` (texto o null) y `rate_conditions`. El ID es la ruta canónica `/hotel/mt/....html`, no un ID numérico de Airbnb. No convertir un JSON de Airbnb a Booking cambiando solo el proveedor.

## Prompt de importación posterior

Después de revisar el archivo, iniciar sesión como propietario en Ownly y adjuntar la pestaña o seleccionar el navegador conectado. No poner credenciales en el prompt. La importación final guarda observaciones: este texto autoriza explícitamente esa acción para el archivo indicado.

```text
@Chrome Usa la pestaña de Ownly donde he iniciado sesión como propietario.
Quiero importar únicamente el archivo [RUTA_COMPLETA_AL_JSON_REVISADO].
Te autorizo a validar e importar las observaciones de ese archivo en esta instalación de Ownly.

Abre /admin/airbnb, busca "Expand your market data now" y selecciona "Validate JSON file". Carga el archivo indicado. Revisa el resultado de validación. Si hay errores, no guardes: explica qué campo hay que corregir sin inventar datos. Si valida correctamente, pulsa "Add … observations" para guardar este lote y comunica cuántas observaciones nuevas se añadieron, cuántas ya existían y cuántas quedaron marcadas para revisión. Comprueba después la cobertura o los resultados con filtros coincidentes. No modifiques programaciones, cuentas, suscripciones ni otros datos.
```

Si la extensión no permite seleccionar archivos, haz ese paso manualmente: **Validate JSON file** y después **Add … observations**. En Chrome, la documentación oficial explica la opción **Allow access to file URLs** de la extensión para cargas locales. Esto no convierte un archivo de capturas (`captures`) en uno de observaciones (`observations`).

## Repetir lotes y trabajar entre computadoras

Conservar parámetros, fecha real y archivo de cada lote en almacenamiento privado. Para ampliar cobertura, cambiar una localidad o estancia a la vez y no rellenar huecos con estimaciones. Los prompts pueden reutilizarse desde GitHub; la sesión del navegador, los datos importados y la configuración `.env` pertenecen a cada instalación. Para una periodicidad desatendida usar la cola Docker documentada en [MARKET-DATA.md](MARKET-DATA.md), no asumir que ChatGPT seguirá trabajando después de cerrar el chat.
