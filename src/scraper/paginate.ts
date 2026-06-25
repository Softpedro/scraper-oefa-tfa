/**
 * Paginación del datatable de PrimeFaces.
 *
 * Cambiar de página dispara un POST AJAX con `source = ...:dt` y el evento
 * `page`. El servidor responde con un `<update id="...:dt">` que trae la tabla
 * con las filas de la página solicitada.
 */
import { AxiosInstance } from "axios";

import { postPartial } from "../http/ajax";
import { FORM_ID, SearchParams } from "./search";

/** Client-id del datatable. */
const DT_ID = `${FORM_ID}:dt`;

export interface FetchPageOptions {
  /** Offset de la primera fila: `(numeroDePagina - 1) * filasPorPagina`. */
  first: number;
  /** Filas por página (10 en este sitio). */
  rows: number;
  /** Filtros activos (mismo sector/expediente que la búsqueda). */
  params?: SearchParams;
}

export interface PageResult {
  /** HTML de la tabla con las filas de la página. */
  tableHtml: string;
  /** ViewState actualizado para la siguiente petición. */
  viewState: string;
}

/**
 * Solicita una página concreta de resultados.
 */
export async function fetchPage(
  http: AxiosInstance,
  viewState: string,
  options: FetchPageOptions
): Promise<PageResult> {
  const { first, rows, params = {} } = options;

  const partial = await postPartial(http, {
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": DT_ID,
    "javax.faces.partial.execute": DT_ID,
    "javax.faces.partial.render": DT_ID,
    "javax.faces.behavior.event": "page",
    "javax.faces.partial.event": "page",
    [`${DT_ID}_pagination`]: "true",
    [`${DT_ID}_first`]: String(first),
    [`${DT_ID}_rows`]: String(rows),
    [`${DT_ID}_encodeFeature`]: "true",
    [FORM_ID]: FORM_ID,
    [`${FORM_ID}:txtNroexp`]: params.expediente ?? "",
    [`${FORM_ID}:idsector`]: params.sector ?? "",
    [`${DT_ID}_scrollState`]: "0,0",
    "javax.faces.ViewState": viewState,
  });

  // Tras paginar, la tabla llega en el update ":dt"; como fallback aceptamos
  // también ":pgLista" por si el sitio renderiza el contenedor completo.
  const tableHtml =
    partial.updates.get(DT_ID) ?? partial.updates.get(`${FORM_ID}:pgLista`);

  if (!tableHtml) {
    throw new Error(
      `La respuesta de paginación no contiene el update '${DT_ID}'.`
    );
  }

  return { tableHtml, viewState: partial.viewState };
}
