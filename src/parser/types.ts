/**
 * Tipos de dominio: la información que extraemos de cada fila de resultados.
 */

/** Un documento (fila de la tabla de resultados). */
export interface Documento {
  /** Número de orden en la tabla (columna "Nro."). */
  nro: string;
  /** Número de expediente (ej. "3428-2018-OEFA/DFAI/PAS"). */
  expediente: string;
  /** Administrado (empresa sancionada). */
  administrado: string;
  /** Unidad fiscalizable. */
  unidadFiscalizable: string;
  /** Sector (Electricidad, Hidrocarburos, etc.). */
  sector: string;
  /** Nro. de Resolución de Apelación (o "Información confidencial"). */
  nroResolucion: string;
  /**
   * UUID del PDF asociado, extraído del enlace de descarga.
   * `null` cuando la fila no tiene archivo (ej. "Información confidencial").
   */
  pdfUuid: string | null;
  /**
   * Client-id del enlace de descarga (ej. "...:dt:0:j_idt63"). Es el `source`
   * que el POST de descarga (full postback de mojarra) necesita junto al
   * `param_uuid`. `null` cuando la fila no tiene archivo.
   */
  pdfSourceId: string | null;
  /**
   * Nombre del archivo PDF ya descargado (dentro de la carpeta de PDFs).
   * `null` mientras no se haya descargado. Permite reanudar sin re-descargar.
   */
  pdfFile: string | null;
  /** Índice de la fila dentro de la página (atributo `data-ri`). */
  rowIndex: number;
}

/** Información de paginación leída del pie de la tabla. */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
}
