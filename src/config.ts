/**
 * Configuración central del scraper.
 *
 * Las URLs apuntan por defecto al sitio de desarrollo (OEFA). El sitio de
 * producción (Poder Judicial) puede inyectarse por variables de entorno sin
 * tocar el código.
 */

export const BASE_URL = process.env.BASE_URL ?? "https://publico.oefa.gob.pe";

/** Página del buscador (formulario JSF + tabla de resultados). */
export const SEARCH_PAGE_PATH =
  process.env.SEARCH_PAGE_PATH ?? "/repdig/consulta/consultaTfa.xhtml";

export const SEARCH_PAGE_URL = `${BASE_URL}${SEARCH_PAGE_PATH}`;

/** User-Agent de navegador real: muchos sitios JSF rechazan clientes "raros". */
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Timeout por petición (ms). */
export const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 30_000);

/** Delay base entre peticiones para no saturar el servidor (ms). */
export const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS ?? 1_000);

/** Carpeta donde se guardan los datos extraídos y el checkpoint. */
export const OUTPUT_DIR = process.env.OUTPUT_DIR ?? "output";

/** Carpeta donde se guardan los PDFs descargados. */
export const PDF_DIR = process.env.PDF_DIR ?? "pdfs";

/** Máximo de reintentos ante 429 / errores transitorios. */
export const RETRY_MAX = Number(process.env.RETRY_MAX ?? 5);

/** Delay base del backoff exponencial (ms). El delay crece base·2^n. */
export const RETRY_BASE_DELAY_MS = Number(process.env.RETRY_BASE_DELAY_MS ?? 1_000);

/** Tope del backoff exponencial (ms) para no esperar indefinidamente. */
export const RETRY_MAX_DELAY_MS = Number(process.env.RETRY_MAX_DELAY_MS ?? 30_000);
