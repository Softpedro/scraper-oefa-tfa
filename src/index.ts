/**
 * Punto de entrada del scraper.
 *
 * Flujo normal (`npm start`): carga lo guardado → lee checkpoint → GET inicial →
 * recorre páginas (reanudando si corresponde) → por cada página guarda los datos,
 * actualiza el checkpoint y descarga los PDFs de esa página (con backoff ante
 * 429). Los que fallan se anotan en output/failed.json.
 *
 * Modo reintento (`npm run retry`, flag --retry-failed): vuelve a recorrer las
 * páginas necesarias y reintenta solo las descargas que quedaron en failed.json.
 *
 * Variables de entorno:
 *   MAX_PAGES       límite de páginas (0 = todas). Default 3 (pruebas).
 *   SECTOR          filtro de sector ("" = Todos). Default "".
 *   DOWNLOAD_PDFS   "0" para no descargar PDFs (solo extraer datos). Default sí.
 */
import * as fs from "fs";
import * as path from "path";

import { AxiosInstance } from "axios";

import { createHttpClient } from "./http/client";
import { extractViewStateFromHtml } from "./http/viewState";
import { scrapeAllDocuments } from "./scraper/scrape";
import { downloadPdf } from "./scraper/downloadPdf";
import { DocumentStore } from "./store/documentStore";
import { FailedLog } from "./store/failedLog";
import {
  readCheckpoint,
  writeCheckpoint,
  clearCheckpoint,
} from "./store/checkpoint";
import { withRetry } from "./util/backoff";
import { sleep } from "./util/sleep";
import { Documento } from "./parser/types";
import {
  SEARCH_PAGE_URL,
  PDF_DIR,
  REQUEST_DELAY_MS,
  RETRY_MAX,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
} from "./config";

const MAX_PAGES = Number(process.env.MAX_PAGES ?? 3);
const SECTOR = process.env.SECTOR ?? ""; // "" = Todos
const DOWNLOAD_PDFS = process.env.DOWNLOAD_PDFS !== "0";
const RETRY_FAILED = process.argv.includes("--retry-failed");

async function main(): Promise<void> {
  const store = new DocumentStore();
  store.load();

  const failed = new FailedLog();
  failed.load();

  // UUIDs ya descargados (con archivo presente en disco): no se vuelven a bajar.
  const downloaded = loadDownloadedSet(store);

  // GET inicial: sesión + ViewState.
  const { http, jar } = createHttpClient();
  console.log(`→ GET ${SEARCH_PAGE_URL}`);
  const res = await http.get<string>(SEARCH_PAGE_URL);
  const cookies = await jar.getCookies(SEARCH_PAGE_URL);
  const jsession = cookies.find((c) => c.key === "JSESSIONID");
  console.log(
    `  status ${res.status} · ${jsession ? "JSESSIONID OK" : "⚠️  sin sesión"}`
  );
  const viewState = extractViewStateFromHtml(res.data);

  if (RETRY_FAILED) {
    await runRetry(http, viewState, store, failed, downloaded);
  } else {
    await runScrape(http, viewState, store, failed, downloaded);
  }

  console.log(`\n✓ ${store.size} documentos en output/data.json`);
  if (DOWNLOAD_PDFS || RETRY_FAILED) {
    console.log(`✓ ${downloaded.size} PDFs en ${PDF_DIR}/`);
    if (failed.size > 0) {
      console.log(
        `⚠️  ${failed.size} descargas pendientes en output/failed.json ` +
          "(reintenta con: npm run retry)"
      );
    }
  }
}

/** Recorrido normal: extrae datos y descarga PDFs página a página. */
async function runScrape(
  http: AxiosInstance,
  viewState: string,
  store: DocumentStore,
  failed: FailedLog,
  downloaded: Set<string>
): Promise<void> {
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

  console.log(
    `→ Recorriendo (sector: ${SECTOR || "Todos"}, límite: ${
      MAX_PAGES === 0 ? "todas" : MAX_PAGES
    }, PDFs: ${DOWNLOAD_PDFS ? "sí" : "no"})\n`
  );

  await scrapeAllDocuments(http, viewState, {
    params: { sector: SECTOR },
    startPage,
    maxPages: MAX_PAGES === 0 ? undefined : MAX_PAGES,
    onPage: async ({ page, totalPages, totalRecords, pageDocs, viewState: pageVs }) => {
      store.add(pageDocs);
      store.save(); // persistir datos antes de actualizar el checkpoint
      writeCheckpoint({
        lastCompletedPage: page,
        totalPages,
        totalRecords,
        sector: SECTOR,
        updatedAt: new Date().toISOString(),
      });

      const conPdf = pageDocs.filter((d) => d.pdfUuid && d.pdfSourceId).length;
      console.log(
        `  página ${String(page).padStart(3)}/${totalPages} · ` +
          `+${pageDocs.length} (${conPdf} con PDF) · total ${store.size}/${totalRecords}`
      );

      if (DOWNLOAD_PDFS) {
        await downloadPagePdfs(http, pageVs, page, pageDocs, failed, downloaded);
        store.save(); // persistir los pdfFile asignados
      }
    },
  });

  // Si se completaron todas las páginas, limpiar el checkpoint.
  const finalCp = readCheckpoint();
  if (finalCp && finalCp.lastCompletedPage >= finalCp.totalPages) {
    clearCheckpoint();
    console.log("\n✓ Recorrido completo: checkpoint limpiado.");
  }
}

/** Modo reintento: re-recorre y reintenta solo lo anotado en failed.json. */
async function runRetry(
  http: AxiosInstance,
  viewState: string,
  store: DocumentStore,
  failed: FailedLog,
  downloaded: Set<string>
): Promise<void> {
  const pending = failed.all();
  if (pending.length === 0) {
    console.log("✓ No hay descargas fallidas pendientes.");
    return;
  }

  const targets = new Set(pending.map((f) => f.pdfUuid));
  const maxPage = Math.max(...pending.map((f) => f.page));
  console.log(
    `↻ Reintentando ${targets.size} descargas fallidas ` +
      `(sector: ${SECTOR || "Todos"}, hasta página ${maxPage}).\n`
  );

  await scrapeAllDocuments(http, viewState, {
    params: { sector: SECTOR },
    startPage: 1,
    maxPages: maxPage,
    onPage: async ({ page, pageDocs, viewState: pageVs }) => {
      const toRetry = pageDocs.filter(
        (d) =>
          d.pdfUuid &&
          d.pdfSourceId &&
          targets.has(d.pdfUuid) &&
          !downloaded.has(d.pdfUuid)
      );
      if (toRetry.length === 0) return;

      console.log(`  página ${page}: ${toRetry.length} por reintentar`);
      await downloadPagePdfs(http, pageVs, page, toRetry, failed, downloaded);
      store.add(toRetry); // refrescar pdfFile en el store
      store.save();
    },
  });

  console.log(`\n✓ Reintento terminado. Pendientes: ${failed.size}`);
}

/** Descarga (con backoff) todos los PDFs de una página, anotando los fallidos. */
async function downloadPagePdfs(
  http: AxiosInstance,
  viewState: string,
  page: number,
  docs: Documento[],
  failed: FailedLog,
  downloaded: Set<string>
): Promise<void> {
  const conPdf = docs.filter((d) => d.pdfUuid && d.pdfSourceId);

  for (const doc of conPdf) {
    if (downloaded.has(doc.pdfUuid!)) continue; // ya descargado en otra corrida

    try {
      const result = await withRetry(
        () => downloadPdf(http, viewState, doc, { sector: SECTOR }),
        {
          retries: RETRY_MAX,
          baseDelayMs: RETRY_BASE_DELAY_MS,
          maxDelayMs: RETRY_MAX_DELAY_MS,
          onRetry: ({ attempt, delayMs, status }) =>
            console.log(
              `    ⏳ ${doc.expediente}: ${status ?? "red"} — ` +
                `reintento ${attempt}/${RETRY_MAX} en ${Math.round(delayMs / 1000)}s`
            ),
        }
      );

      doc.pdfFile = result.fileName;
      downloaded.add(doc.pdfUuid!);
      failed.remove(doc.pdfUuid!);
      console.log(`    ⬇️  ${result.fileName} (${formatKb(result.bytes)})`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failed.add({
        pdfUuid: doc.pdfUuid!,
        expediente: doc.expediente,
        nroResolucion: doc.nroResolucion,
        page,
        rowIndex: doc.rowIndex,
        sector: SECTOR,
        reason,
        attempts: RETRY_MAX + 1,
        updatedAt: new Date().toISOString(),
      });
      console.log(`    ✗ ${doc.expediente}: ${reason}`);
    }

    await sleep(REQUEST_DELAY_MS); // no saturar el servidor entre descargas
  }
}

/** Reconstruye el set de UUIDs ya descargados (archivo presente en disco). */
function loadDownloadedSet(store: DocumentStore): Set<string> {
  const set = new Set<string>();
  for (const d of store.all()) {
    if (d.pdfUuid && d.pdfFile && fs.existsSync(path.join(PDF_DIR, d.pdfFile))) {
      set.add(d.pdfUuid);
    }
  }
  return set;
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
