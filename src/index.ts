/**
 * Punto de entrada del scraper.
 *
 * Fase actual: navegación completa por paginación. Flujo: GET inicial → búsqueda
 * → recorrido de páginas (search para la 1, evento `page` para el resto),
 * acumulando los documentos de cada página.
 *
 * Para no saturar el servidor durante las pruebas, se limita el número de
 * páginas con la variable de entorno MAX_PAGES (por defecto 3). Usar
 * MAX_PAGES=0 para recorrer TODAS las páginas.
 */
import { createHttpClient } from "./http/client";
import { extractViewStateFromHtml } from "./http/viewState";
import { scrapeAllDocuments } from "./scraper/scrape";
import { SEARCH_PAGE_URL } from "./config";

/** 0 = todas las páginas; cualquier otro número limita el recorrido (pruebas). */
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 3);

async function main(): Promise<void> {
  const { http, jar } = createHttpClient();

  // 1) GET inicial: sesión + ViewState.
  console.log(`→ GET ${SEARCH_PAGE_URL}`);
  const res = await http.get<string>(SEARCH_PAGE_URL);
  const cookies = await jar.getCookies(SEARCH_PAGE_URL);
  const jsession = cookies.find((c) => c.key === "JSESSIONID");
  console.log(`  status ${res.status} · ${jsession ? "JSESSIONID OK" : "⚠️  sin sesión"}`);

  const viewState = extractViewStateFromHtml(res.data);

  // 2) Recorrer páginas (sector "" = Todos).
  console.log(
    `→ Recorriendo páginas (límite: ${MAX_PAGES === 0 ? "todas" : MAX_PAGES})\n`
  );

  const docs = await scrapeAllDocuments(http, viewState, {
    params: { sector: "" },
    maxPages: MAX_PAGES === 0 ? undefined : MAX_PAGES,
    onPage: ({ page, totalPages, totalRecords, pageDocs, accumulated }) => {
      const conPdf = pageDocs.filter((d) => d.pdfUuid).length;
      console.log(
        `  página ${String(page).padStart(3)}/${totalPages} · ` +
          `+${pageDocs.length} docs (${conPdf} con PDF) · ` +
          `acumulado ${accumulated}/${totalRecords}`
      );
    },
  });

  const conPdf = docs.filter((d) => d.pdfUuid).length;
  console.log(`\n✓ ${docs.length} documentos extraídos (${conPdf} con PDF).`);
  console.log("Ejemplo:", JSON.stringify(docs[docs.length - 1], null, 2));
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
