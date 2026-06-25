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
  /** Límite de páginas a recorrer (para pruebas). `undefined` = todas. */
  maxPages?: number;
  /** Callback por cada página procesada (para logging/progreso). */
  onPage?: (info: {
    page: number;
    totalPages: number;
    totalRecords: number;
    pageDocs: Documento[];
    accumulated: number;
  }) => void;
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
  const { params = {}, maxPages, onPage } = options;

  // Página 1: se obtiene mediante la búsqueda.
  const first = await search(http, initialViewState, params);
  let viewState = first.viewState;
  const pagination = parsePagination(first.tableHtml);

  const documentos: Documento[] = [];
  const pushPage = (page: number, tableHtml: string) => {
    const pageDocs = parseResults(tableHtml);
    documentos.push(...pageDocs);
    onPage?.({
      page,
      totalPages: pagination.totalPages,
      totalRecords: pagination.totalRecords,
      pageDocs,
      accumulated: documentos.length,
    });
  };

  pushPage(1, first.tableHtml);

  const lastPage = maxPages
    ? Math.min(maxPages, pagination.totalPages)
    : pagination.totalPages;

  // Páginas 2..N: vía el evento de paginación del datatable.
  for (let page = 2; page <= lastPage; page++) {
    await sleep(REQUEST_DELAY_MS); // delay para no saturar el servidor
    const result = await fetchPage(http, viewState, {
      first: (page - 1) * ROWS_PER_PAGE,
      rows: ROWS_PER_PAGE,
      params,
    });
    viewState = result.viewState; // actualizar para la siguiente iteración
    pushPage(page, result.tableHtml);
  }

  return documentos;
}
