/**
 * Parseo del HTML de la tabla de resultados (el fragmento que viene en el
 * `<update id="...:pgLista">` de la respuesta AJAX).
 */
import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";

import { Documento, PaginationInfo } from "./types";

/** El enlace de descarga lleva el UUID dentro de un onclick de mojarra:
 *    ...{'...:j_idt63':'...','param_uuid':'4c6b30c2-9dd8-4b61-...'},'')...
 */
const UUID_REGEX = /'param_uuid'\s*:\s*'([0-9a-fA-F-]+)'/;

/** Texto de la paginación: "Página 1 de 13 (125 registros)". */
const PAGINATION_REGEX = /Página\s+(\d+)\s+de\s+(\d+)\s+\((\d+)/;

/**
 * Extrae los documentos de una página de resultados.
 */
export function parseResults(tableHtml: string): Documento[] {
  const $ = cheerio.load(tableHtml);
  const docs: Documento[] = [];

  // El cuerpo de la tabla tiene id terminado en "dt_data".
  $("tbody[id$='dt_data'] > tr").each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.children("td");

    // Filas válidas tienen 7 columnas. Mensajes ("sin resultados") tienen menos.
    if (cells.length < 7) return;

    docs.push({
      nro: cellText($, cells.eq(0)),
      expediente: cellText($, cells.eq(1)),
      administrado: cellText($, cells.eq(2)),
      unidadFiscalizable: cellText($, cells.eq(3)),
      sector: cellText($, cells.eq(4)),
      nroResolucion: cellText($, cells.eq(5)),
      pdfUuid: extractUuid(cells.eq(6).find("a[onclick]").attr("onclick")),
      rowIndex: Number($tr.attr("data-ri") ?? -1),
    });
  });

  return docs;
}

/**
 * Lee la info de paginación del pie de la tabla.
 */
export function parsePagination(tableHtml: string): PaginationInfo {
  const $ = cheerio.load(tableHtml);
  const text = $(".ui-paginator-current").first().text();
  const match = text.match(PAGINATION_REGEX);

  if (!match) {
    // Sin paginador visible: asumimos una sola página con lo que haya.
    return { currentPage: 1, totalPages: 1, totalRecords: 0 };
  }

  return {
    currentPage: Number(match[1]),
    totalPages: Number(match[2]),
    totalRecords: Number(match[3]),
  };
}

function cellText($: CheerioAPI, cell: Cheerio<Element>): string {
  return $(cell).text().trim();
}

function extractUuid(onclick: string | undefined): string | null {
  if (!onclick) return null;
  const match = onclick.match(UUID_REGEX);
  return match ? match[1] : null;
}
