/**
 * Helper para los POST AJAX de PrimeFaces.
 *
 * Centraliza las cabeceras que el servidor espera en cada petición parcial y
 * devuelve ya parseada la respuesta `<partial-response>`. Lo usan tanto la
 * búsqueda como la paginación.
 */
import { AxiosInstance } from "axios";

import { SEARCH_PAGE_URL } from "../config";
import { parsePartialResponse, PartialResponse } from "./partialResponse";

const AJAX_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
  // Cabeceras propias de las peticiones AJAX de PrimeFaces/JSF:
  "Faces-Request": "partial/ajax",
  "X-Requested-With": "XMLHttpRequest",
};

/**
 * Envía un POST `x-www-form-urlencoded` al endpoint del buscador y devuelve la
 * respuesta parcial ya parseada (updates + ViewState nuevo).
 */
export async function postPartial(
  http: AxiosInstance,
  params: Record<string, string>
): Promise<PartialResponse> {
  const body = new URLSearchParams(params).toString();
  const res = await http.post<string>(SEARCH_PAGE_URL, body, {
    headers: AJAX_HEADERS,
  });
  return parsePartialResponse(res.data);
}
