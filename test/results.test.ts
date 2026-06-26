/**
 * Tests del parseo de la tabla de resultados: filas, UUID/source del PDF,
 * filas confidenciales, filas sueltas de paginación y la info del paginador.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseResults, parsePagination } from "../src/parser/results";

/** Fila con PDF (onclick de mojarra con source + param_uuid). */
const ROW_WITH_PDF = `
  <tr data-ri="0">
    <td>1</td>
    <td>3428-2018-OEFA/DFAI/PAS</td>
    <td>Empresa Concesionaria De Electricidad De Ucayali S.A.</td>
    <td>Central Hidroeléctrica De Pomabamba</td>
    <td>Electricidad</td>
    <td>0229-2020-OEFA/TFA-SE</td>
    <td>
      <a href="#" onclick="mojarra.jsfcljs(document.getElementById('listarDetalleInfraccionRAAForm'),{'listarDetalleInfraccionRAAForm:dt:0:j_idt63':'listarDetalleInfraccionRAAForm:dt:0:j_idt63','param_uuid':'4c6b30c2-9dd8-4b61-a592-9b0ef82d83ab'},'')">PDF</a>
    </td>
  </tr>`;

/** Fila sin archivo: "Información confidencial" (sin enlace). */
const ROW_CONFIDENTIAL = `
  <tr data-ri="1">
    <td>2</td>
    <td>3341-2018-OEFA/DFAI/PAS</td>
    <td>Electro Oriente S.A.</td>
    <td>C.T. Caballococha</td>
    <td>Electricidad</td>
    <td>Información confidencial</td>
    <td>Información confidencial</td>
  </tr>`;

const FULL_TABLE = `
  <table><tbody>${ROW_WITH_PDF}${ROW_CONFIDENTIAL}</tbody></table>`;

test("parsea una fila con PDF: datos, UUID y source del link", () => {
  const docs = parseResults(FULL_TABLE);
  assert.equal(docs.length, 2);

  const d = docs[0];
  assert.equal(d.nro, "1");
  assert.equal(d.expediente, "3428-2018-OEFA/DFAI/PAS");
  assert.equal(d.administrado, "Empresa Concesionaria De Electricidad De Ucayali S.A.");
  assert.equal(d.sector, "Electricidad");
  assert.equal(d.nroResolucion, "0229-2020-OEFA/TFA-SE");
  assert.equal(d.pdfUuid, "4c6b30c2-9dd8-4b61-a592-9b0ef82d83ab");
  assert.equal(d.pdfSourceId, "listarDetalleInfraccionRAAForm:dt:0:j_idt63");
  assert.equal(d.pdfFile, null);
  assert.equal(d.rowIndex, 0);
});

test("una fila confidencial no tiene PDF (uuid y source en null)", () => {
  const docs = parseResults(FULL_TABLE);
  const d = docs[1];
  assert.equal(d.pdfUuid, null);
  assert.equal(d.pdfSourceId, null);
  assert.equal(d.rowIndex, 1);
});

test("parsea filas sueltas (fragmento de paginación, sin <table>)", () => {
  // La paginación devuelve <tr> sin envoltorio: el parser debe envolverlos.
  const bareRow = ROW_WITH_PDF.replace('data-ri="0"', 'data-ri="10"');
  const docs = parseResults(bareRow);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].rowIndex, 10);
  assert.equal(docs[0].pdfSourceId, "listarDetalleInfraccionRAAForm:dt:0:j_idt63");
});

test("colapsa espacios y saltos de línea en las celdas", () => {
  const messy = `
    <tr data-ri="0">
      <td>1</td>
      <td>4586-06-PRODUCE/DIGSECOVI-Dsvs

      930-2008-PRODUCE/CAS</td>
      <td>X</td><td>Y</td><td>Pesquería</td><td>R-1</td><td>-</td>
    </tr>`;
  const docs = parseResults(messy);
  assert.equal(
    docs[0].expediente,
    "4586-06-PRODUCE/DIGSECOVI-Dsvs 930-2008-PRODUCE/CAS"
  );
});

test("parsePagination lee página, total de páginas y registros", () => {
  const html = `
    <div>
      <span class="ui-paginator-current">Página 1 de 13 (125 registros)</span>
    </div>`;
  const p = parsePagination(html);
  assert.deepEqual(p, { currentPage: 1, totalPages: 13, totalRecords: 125 });
});

test("parsePagination sin paginador asume una sola página", () => {
  const p = parsePagination("<div>sin resultados</div>");
  assert.equal(p.totalPages, 1);
});
