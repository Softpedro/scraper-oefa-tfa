/**
 * Ejecuta la búsqueda (POST AJAX de PrimeFaces) y devuelve el HTML de la tabla
 * de resultados junto con el ViewState actualizado.
 *
 * El botón "Buscar" del sitio dispara:
 *   PrimeFaces.ab({ s: "...:btnBuscar", u: "...:pgLista ...:txtNroexp" })
 * lo que se traduce en este POST `application/x-www-form-urlencoded`.
 */
import { AxiosInstance } from "axios";

import { postPartial } from "../http/ajax";

/** Prefijo del formulario JSF; todos los campos lo usan como namespace. */
export const FORM_ID = "listarDetalleInfraccionRAAForm";

const PGLISTA_ID = `${FORM_ID}:pgLista`;

export interface SearchParams {
  /** Valor del combo de sector. "" = Todos (default). Ej: "2" = Electricidad. */
  sector?: string;
  /** Texto del campo "Número de expediente". Vacío por defecto. */
  expediente?: string;
}

export interface SearchResult {
  /** HTML de la tabla de resultados (contenido del update pgLista). */
  tableHtml: string;
  /** ViewState actualizado para la siguiente petición. */
  viewState: string;
}

/**
 * Hace la búsqueda y devuelve la tabla + el nuevo ViewState.
 */
export async function search(
  http: AxiosInstance,
  viewState: string,
  params: SearchParams = {}
): Promise<SearchResult> {
  const partial = await postPartial(http, {
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": `${FORM_ID}:btnBuscar`,
    "javax.faces.partial.execute": "@all",
    "javax.faces.partial.render": `${PGLISTA_ID} ${FORM_ID}:txtNroexp`,
    [`${FORM_ID}:btnBuscar`]: `${FORM_ID}:btnBuscar`,
    [FORM_ID]: FORM_ID,
    [`${FORM_ID}:txtNroexp`]: params.expediente ?? "",
    [`${FORM_ID}:idsector`]: params.sector ?? "",
    [`${FORM_ID}:dt_scrollState`]: "0,0",
    "javax.faces.ViewState": viewState,
  });

  const tableHtml = partial.updates.get(PGLISTA_ID);

  if (!tableHtml) {
    throw new Error(
      `La respuesta no contiene el update '${PGLISTA_ID}'. ` +
        "Revisa los parámetros del POST o el ViewState."
    );
  }

  return { tableHtml, viewState: partial.viewState };
}
