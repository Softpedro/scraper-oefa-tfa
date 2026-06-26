/**
 * Orquesta el recorrido completo: búsqueda + paginación de todas las páginas.
 */
import { AxiosInstance } from "axios";

import { REQUEST_DELAY_MS } from "../config";
import { sleep } from "../util/sleep";
import { Documento } from "../parser/types";
import { parseResults, parsePagination } from "../parser/results";
import { search, SearchParams } from "./search";
import { fetchPage } from "./paginate";

/** Filas por página que usa el datatable del sitio. */
const ROWS_PER_PAGE = 10;

export interface ScrapeOptions {
  /** Filtros de búsqueda. Por defecto sector "" (Todos). */
  params?: SearchParams;
  /** Página desde la que arrancar (para reanudar). Por defecto 1. */
  startPage?: number;
  /** Límite de páginas a recorrer (para pruebas). `undefined` = todas. */
  maxPages?: number;
  /**
   * Callback por cada página procesada (para guardar/loguear). Puede ser
   * asíncrono: el recorrido espera a que termine antes de seguir, de modo que
   * la persistencia ocurre página a página.
   */
  onPage?: (info: {
    page: number;
    totalPages: number;
    totalRecords: number;
    pageDocs: Documento[];
    accumulated: number;
    /** ViewState vigente tras renderizar esta página (necesario para descargar). */
    viewState: string;
  }) => void | Promise<void>;
}

/**
 * Recorre los resultados página por página y devuelve todos los documentos.
 *
 * @param initialViewState ViewState obtenido del GET inicial.
 */
export async function scrapeAllDocuments(
  http: AxiosInstance,
  initialViewState: string,
  options: ScrapeOptions = {}
): Promise<Documento[]> {
  const { params = {}, startPage = 1, maxPages, onPage } = options;

  // La búsqueda siempre se ejecuta: deja el datatable en un estado válido y nos
  // da el ViewState + el total de páginas (aunque vayamos a reanudar más adelante).
  const first = await search(http, initialViewState, params);
  let viewState = first.viewState;
  const pagination = parsePagination(first.tableHtml);

  const documentos: Documento[] = [];
  const handlePage = async (
    page: number,
    tableHtml: string,
    pageViewState: string
  ) => {
    const pageDocs = parseResults(tableHtml);
    documentos.push(...pageDocs);
    await onPage?.({
      page,
      totalPages: pagination.totalPages,
      totalRecords: pagination.totalRecords,
      pageDocs,
      accumulated: documentos.length,
      viewState: pageViewState,
    });
  };

  // La página 1 solo se procesa si arrancamos desde ella (al reanudar se salta).
  if (startPage <= 1) {
    await handlePage(1, first.tableHtml, viewState);
  }

  const lastPage = maxPages
    ? Math.min(maxPages, pagination.totalPages)
    : pagination.totalPages;

  // Páginas 2..N (o desde startPage): el evento de paginación acepta un offset
  // absoluto, así que se puede saltar directo a la página de reanudación.
  for (let page = Math.max(2, startPage); page <= lastPage; page++) {
    await sleep(REQUEST_DELAY_MS); // delay para no saturar el servidor
    const result = await fetchPage(http, viewState, {
      first: (page - 1) * ROWS_PER_PAGE,
      rows: ROWS_PER_PAGE,
      params,
    });
    viewState = result.viewState; // actualizar para la siguiente iteración
    await handlePage(page, result.tableHtml, viewState);
  }

  return documentos;
}
