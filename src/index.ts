/**
 * Punto de entrada del scraper.
 *
 * Fase actual: búsqueda y extracción de la primera página de resultados.
 * Flujo: GET inicial (sesión + ViewState) → POST de búsqueda → parseo del
 * `<partial-response>` → documentos de la página 1.
 */
import { createHttpClient } from "./http/client";
import { extractViewStateFromHtml } from "./http/viewState";
import { search } from "./scraper/search";
import { parseResults, parsePagination } from "./parser/results";
import { SEARCH_PAGE_URL } from "./config";

async function main(): Promise<void> {
  const { http, jar } = createHttpClient();

  // 1) GET inicial: establece la sesión y obtiene el ViewState.
  console.log(`→ GET ${SEARCH_PAGE_URL}`);
  const res = await http.get<string>(SEARCH_PAGE_URL);
  const cookies = await jar.getCookies(SEARCH_PAGE_URL);
  const jsession = cookies.find((c) => c.key === "JSESSIONID");
  console.log(`  status ${res.status} · ${jsession ? "JSESSIONID OK" : "⚠️  sin sesión"}`);

  let viewState = extractViewStateFromHtml(res.data);

  // 2) POST de búsqueda. Sector "" = Todos → trae todos los registros.
  console.log("→ POST búsqueda (sector: Todos)");
  const result = await search(http, viewState, { sector: "" });
  viewState = result.viewState; // ← clave: actualizar el ViewState para el siguiente POST

  // 3) Parsear resultados y paginación.
  const docs = parseResults(result.tableHtml);
  const pag = parsePagination(result.tableHtml);

  console.log(
    `  ${pag.totalRecords} registros · ${pag.totalPages} páginas · ` +
      `${docs.length} documentos en esta página`
  );
  console.log(`  ViewState actualizado (${viewState.length} chars)\n`);

  // Muestra de los primeros resultados.
  console.log("Primeros resultados:");
  for (const d of docs.slice(0, 5)) {
    const pdf = d.pdfUuid ? `pdf=${d.pdfUuid}` : "sin PDF";
    console.log(`  ${d.nro.padStart(2)} · ${d.expediente} · ${d.administrado} · ${pdf}`);
  }

  console.log("\n✓ Búsqueda y extracción de la primera página OK.");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
