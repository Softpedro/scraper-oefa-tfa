/**
 * Parseo del HTML de la tabla de resultados (el fragmento que viene en el
 * `<update id="...:pgLista">` de la respuesta AJAX).
 */
import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";

import { Documento, PaginationInfo } from "./types";

/** El enlace de descarga lleva el UUID dentro de un onclick de mojarra:
 *    mojarra.jsfcljs(form,{'...:dt:0:j_idt63':'...:dt:0:j_idt63',
 *                          'param_uuid':'4c6b30c2-9dd8-4b61-...'},'')
 */
const UUID_REGEX = /'param_uuid'\s*:\s*'([0-9a-fA-F-]+)'/;

/** El primer key del objeto de mojarra es el client-id del link (el `source`). */
const SOURCE_ID_REGEX = /\{\s*'([^']+)'\s*:/;

/** Texto de la paginación: "Página 1 de 13 (125 registros)". */
const PAGINATION_REGEX = /Página\s+(\d+)\s+de\s+(\d+)\s+\((\d+)/;

/**
 * Extrae los documentos de una página de resultados.
 */
export function parseResults(tableHtml: string): Documento[] {
  const $ = loadRows(tableHtml);
  const docs: Documento[] = [];

  // Cada fila de datos tiene el atributo `data-ri` (row index). Esto funciona
  // tanto para la tabla completa (búsqueda) como para el fragmento de filas
  // sueltas que devuelve la paginación.
  $("tr[data-ri]").each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.children("td");

    // Filas válidas tienen 7 columnas. Mensajes ("sin resultados") tienen menos.
    if (cells.length < 7) return;

    const onclick = cells.eq(6).find("a[onclick]").attr("onclick");
    const { uuid, sourceId } = parseDownloadLink(onclick);

    docs.push({
      nro: cellText($, cells.eq(0)),
      expediente: cellText($, cells.eq(1)),
      administrado: cellText($, cells.eq(2)),
      unidadFiscalizable: cellText($, cells.eq(3)),
      sector: cellText($, cells.eq(4)),
      nroResolucion: cellText($, cells.eq(5)),
      pdfUuid: uuid,
      // El source solo tiene sentido si hay UUID (fila con archivo).
      pdfSourceId: uuid ? sourceId : null,
      pdfFile: null,
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

/**
 * Carga el HTML para parsear filas. La paginación devuelve `<tr>` sueltos (sin
 * `<table>`), que el parser HTML descartaría; por eso los envolvemos en una
 * tabla. La búsqueda ya trae la tabla completa, así que se carga tal cual.
 */
function loadRows(html: string): CheerioAPI {
  const wrapped = /<table[\s>]/i.test(html)
    ? html
    : `<table><tbody>${html}</tbody></table>`;
  return cheerio.load(wrapped);
}

function cellText($: CheerioAPI, cell: Cheerio<Element>): string {
  // Colapsa espacios/saltos de línea internos (algunas celdas traen varios
  // expedientes separados por saltos) para dejar el texto en una sola línea.
  return $(cell).text().replace(/\s+/g, " ").trim();
}

/**
 * Extrae del `onclick` de mojarra el UUID del PDF y el client-id del link.
 * Devuelve ambos en `null` si la fila no tiene enlace de descarga.
 */
function parseDownloadLink(onclick: string | undefined): {
  uuid: string | null;
  sourceId: string | null;
} {
  if (!onclick) return { uuid: null, sourceId: null };
  const uuid = onclick.match(UUID_REGEX)?.[1] ?? null;
  const sourceId = onclick.match(SOURCE_ID_REGEX)?.[1] ?? null;
  return { uuid, sourceId };
}
