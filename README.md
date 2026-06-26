# Scraper OEFA / TFA (TypeScript)

Scraper en **TypeScript** que recorre el buscador del **Registro de Infracciones y Sanciones**
del Tribunal de Fiscalización Ambiental (OEFA), extrae los datos de cada resolución, navega
**todas las páginas** y **descarga los PDFs** asociados con nombres descriptivos, manejando el
_rate limiting_ (**429**) con reintentos y backoff exponencial.

> **Sitio objetivo:** https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml
>
> Hecho **solo con peticiones HTTP + parseo** (axios + cheerio). **Sin automatización de
> navegador** (nada de Puppeteer/Playwright/Selenium).

## Por qué no fue un scraping "normal"

El sitio está construido con **JSF / PrimeFaces**, así que no hay HTML estático ni una URL por
página que puedas pedir con un `GET`. Para sacar los datos hay que comportarse como el navegador:

1. **Mantener sesión** (`JSESSIONID`) desde el primer `GET`.
2. **Reenviar el `ViewState`** (`javax.faces.ViewState`) en cada petición; el servidor lo rota y
   hay que volver a extraerlo de cada respuesta.
3. **Hablar AJAX parcial**: la búsqueda y la paginación responden con un XML
   `<partial-response>` que trae el HTML de la tabla dentro de un `CDATA`, no una página entera.
4. **Disparar la descarga como lo hace el form**: el ícono de PDF ejecuta `mojarra.jsfcljs`, que
   arma un POST con `param_uuid` + el `ViewState` de esa página y devuelve el binario.

Todo el proceso de ingeniería inversa (con cURLs, payloads reales y capturas de DevTools) está
documentado paso a paso en **[`docs/recon.md`](docs/recon.md)**.

## Requisitos

- **Node.js >= 18** (probado con v22)
- npm

## Instalación

```bash
npm install
```

## Uso

```bash
# Recorrido completo: extrae datos + descarga PDFs
npm run scrape

# Reintenta solo las descargas que quedaron en output/failed.json
npm run retry

# Compilar a JavaScript (dist/) y ejecutar el build
npm run build
npm start

# Tests unitarios
npm test
```

### Configuración por variables de entorno

Todo se ajusta sin tocar el código:

| Variable             | Default                         | Para qué sirve |
|----------------------|---------------------------------|----------------|
| `MAX_PAGES`          | `3`                             | Límite de páginas a recorrer. **`0` = todas** (las 176 con "Todos"). El default bajo es para pruebas. |
| `SECTOR`             | `""` (Todos)                    | Filtro de sector (valor del combo). Ej. `2` = Electricidad. |
| `DOWNLOAD_PDFS`      | activado                        | `0` para **no** descargar PDFs (solo extraer datos). |
| `REQUEST_DELAY_MS`   | `1000`                          | Delay entre peticiones para no saturar el servidor. |
| `REQUEST_TIMEOUT_MS` | `30000`                         | Timeout por petición. |
| `RETRY_MAX`          | `5`                             | Reintentos ante 429 / 5xx / errores de red. |
| `RETRY_BASE_DELAY_MS`| `1000`                          | Delay base del backoff exponencial (`base·2^n`). |
| `RETRY_MAX_DELAY_MS` | `30000`                         | Tope del backoff. |
| `OUTPUT_DIR`         | `output`                        | Carpeta de datos y checkpoint. |
| `PDF_DIR`            | `pdfs`                          | Carpeta de PDFs descargados. |
| `BASE_URL` / `SEARCH_PAGE_PATH` | OEFA                 | Apuntar a otro despliegue JSF sin tocar el código. |

Ejemplos:

```bash
# Todas las páginas de todos los sectores, con PDFs
MAX_PAGES=0 npm run scrape

# Solo Electricidad, primeras 5 páginas, sin descargar PDFs
SECTOR=2 MAX_PAGES=5 DOWNLOAD_PDFS=0 npm run scrape
```

## Qué genera

```
output/
  data.json        ← todos los documentos extraídos (acumulado, deduplicado)
  checkpoint.json   ← última página completada (para reanudar)
  failed.json       ← descargas que fallaron tras agotar los reintentos
pdfs/
  RESOLUCION N° 229-2020-OEFA-TFA-SE.pdf
  ...               ← nombre tomado del header Content-Disposition
```

Cada documento en `data.json` se ve así:

```json
{
  "nro": "1",
  "expediente": "3428-2018-OEFA/DFAI/PAS",
  "administrado": "Empresa Concesionaria De Electricidad De Ucayali S.A.",
  "unidadFiscalizable": "Central Hidroeléctrica De Pomabamba",
  "sector": "Electricidad",
  "nroResolucion": "0229-2020-OEFA/TFA-SE",
  "pdfUuid": "4c6b30c2-9dd8-4b61-a592-9b0ef82d83ab",
  "pdfSourceId": "listarDetalleInfraccionRAAForm:dt:0:j_idt63",
  "pdfFile": "RESOLUCION N° 229-2020-OEFA-TFA-SE.pdf",
  "rowIndex": 0
}
```

## Reanudable y tolerante a fallos

- **Checkpoint**: cada página se guarda al instante y se anota en `checkpoint.json`. Si el
  proceso se corta (Ctrl-C, caída de red), la siguiente corrida **retoma desde la página
  siguiente** en vez de empezar de cero. El evento de paginación de PrimeFaces acepta un offset
  absoluto, así que se salta directo a la página de reanudación.
- **Descargas idempotentes**: si el PDF ya está en disco (registrado en `data.json`), no se
  vuelve a bajar.
- **Manejo de 429**: cada descarga se envuelve en un **backoff exponencial** (`base·2^n`, con
  tope y _jitter_) que reintenta ante `429`, `5xx` y errores de red, y respeta el header
  `Retry-After` si el servidor lo envía. Lo que no se logra tras `RETRY_MAX` intentos queda en
  `failed.json` para reprocesar con `npm run retry`.

## Arquitectura

```
src/
  index.ts                 Orquestador: recorrido, persistencia, descarga, modo retry
  config.ts                Configuración central (env vars)
  http/
    client.ts              Cliente axios con cookie jar (sesión JSESSIONID)
    viewState.ts           Extrae el ViewState del HTML inicial
    partialResponse.ts     Parsea el XML <partial-response> (updates + ViewState)
    ajax.ts                Helper para los POST AJAX de PrimeFaces
  scraper/
    search.ts              POST de búsqueda
    paginate.ts            POST de paginación (offset absoluto)
    scrape.ts              Recorre todas las páginas
    downloadPdf.ts         Descarga el PDF (full postback mojarra)
  parser/
    results.ts             Extrae filas (data-ri) y paginación de la tabla
    types.ts               Tipos de dominio (Documento, PaginationInfo)
  store/
    documentStore.ts       Persistencia de datos en JSON (dedup)
    checkpoint.ts          Checkpoint de reanudación
    failedLog.ts           Registro de descargas fallidas
  util/
    backoff.ts             Reintentos con backoff exponencial
    sleep.ts               Delay entre peticiones
```

## Tests

Tests unitarios con el **runner nativo de Node** (`node:test` + `node:assert`), sin dependencias
extra. Cubren la lógica determinista (parseo y reintentos), que es lo que más se puede romper al
tocar el código sin necesidad de pegarle al servidor:

```bash
npm test
```

- `parser/results` — filas, extracción de `param_uuid` y del `source` del link, filas
  "Información confidencial" (sin PDF), fragmentos sueltos de paginación y el paginador.
- `http/partialResponse` — updates por id + ViewState nuevo; error si la sesión cae.
- `http/viewState` — extracción del token del HTML inicial.
- `util/backoff` — reintenta ante 429/5xx/red, se rinde ante errores no recuperables y respeta
  el máximo de reintentos.

## Decisiones técnicas

- **axios + cheerio (sin navegador):** el reto lo pide y, además, una vez entendido el protocolo
  JSF, las peticiones HTTP directas son mucho más rápidas y livianas que un navegador headless.
- **CommonJS, no ESM:** `axios-cookiejar-support` + `tough-cookie` provocaban el _dual-package
  hazard_ con `moduleResolution: nodenext`. Compilar a CommonJS (`module: commonjs`,
  `moduleResolution: node10`) lo resuelve de forma estable.
- **Tipado estricto** (`strict: true`) y una augmentación propia (`src/types/axios.d.ts`) para
  el `jar` del cookie support.
- **Adaptable a producción:** el objetivo real (jurisprudencia del Poder Judicial) usa la misma
  base JSF/PrimeFaces. Apuntando `BASE_URL` / `SEARCH_PAGE_PATH` —y ajustando los ids del
  formulario— el mismo motor sirve.

## Licencia

MIT
