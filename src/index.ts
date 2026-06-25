/**
 * Punto de entrada del scraper.
 *
 * Fase actual: navegación + persistencia con checkpoint reanudable.
 * Flujo: carga lo ya guardado → lee checkpoint → GET inicial → recorre páginas
 * (reanudando si corresponde) → guarda cada página en output/data.json y
 * actualiza el checkpoint.
 *
 * Variables de entorno:
 *   MAX_PAGES  límite de páginas (0 = todas). Default 3 (pruebas).
 *   SECTOR     filtro de sector ("" = Todos). Default "".
 */
import { createHttpClient } from "./http/client";
import { extractViewStateFromHtml } from "./http/viewState";
import { scrapeAllDocuments } from "./scraper/scrape";
import { DocumentStore } from "./store/documentStore";
import {
  readCheckpoint,
  writeCheckpoint,
  clearCheckpoint,
} from "./store/checkpoint";
import { SEARCH_PAGE_URL } from "./config";

const MAX_PAGES = Number(process.env.MAX_PAGES ?? 3);
const SECTOR = process.env.SECTOR ?? ""; // "" = Todos

async function main(): Promise<void> {
  // 0) Cargar lo ya guardado y decidir desde dónde reanudar.
  const store = new DocumentStore();
  store.load();

  const checkpoint = readCheckpoint();
  const resumable = checkpoint && checkpoint.sector === SECTOR;
  const startPage = resumable ? checkpoint!.lastCompletedPage + 1 : 1;

  if (resumable) {
    console.log(
      `↻ Reanudando desde la página ${startPage} ` +
        `(checkpoint en ${checkpoint!.lastCompletedPage}/${checkpoint!.totalPages}, ` +
        `${store.size} docs ya guardados)`
    );
  } else if (checkpoint) {
    console.log("ℹ️  Checkpoint de otro sector; se ignora y se empieza de cero.");
  }

  // 1) GET inicial: sesión + ViewState.
  const { http, jar } = createHttpClient();
  console.log(`→ GET ${SEARCH_PAGE_URL}`);
  const res = await http.get<string>(SEARCH_PAGE_URL);
  const cookies = await jar.getCookies(SEARCH_PAGE_URL);
  const jsession = cookies.find((c) => c.key === "JSESSIONID");
  console.log(`  status ${res.status} · ${jsession ? "JSESSIONID OK" : "⚠️  sin sesión"}`);

  const viewState = extractViewStateFromHtml(res.data);

  // 2) Recorrer páginas, guardando cada una al instante.
  console.log(
    `→ Recorriendo (sector: ${SECTOR || "Todos"}, límite: ${
      MAX_PAGES === 0 ? "todas" : MAX_PAGES
    })\n`
  );

  await scrapeAllDocuments(http, viewState, {
    params: { sector: SECTOR },
    startPage,
    maxPages: MAX_PAGES === 0 ? undefined : MAX_PAGES,
    onPage: async ({ page, totalPages, totalRecords, pageDocs, accumulated }) => {
      store.add(pageDocs);
      store.save(); // persistir antes de actualizar el checkpoint
      writeCheckpoint({
        lastCompletedPage: page,
        totalPages,
        totalRecords,
        sector: SECTOR,
        updatedAt: new Date().toISOString(),
      });

      const conPdf = pageDocs.filter((d) => d.pdfUuid).length;
      console.log(
        `  página ${String(page).padStart(3)}/${totalPages} · ` +
          `+${pageDocs.length} (${conPdf} PDF) · guardado total ${store.size}/${totalRecords}`
      );
    },
  });

  // 3) Si se completaron todas las páginas, limpiar el checkpoint.
  const finalCp = readCheckpoint();
  if (finalCp && finalCp.lastCompletedPage >= finalCp.totalPages) {
    clearCheckpoint();
    console.log("\n✓ Recorrido completo: checkpoint limpiado.");
  }

  console.log(`\n✓ ${store.size} documentos en output/data.json`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
