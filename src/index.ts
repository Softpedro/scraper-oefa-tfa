/**
 * Punto de entrada del scraper.
 *
 * Fase actual: establecer la sesión y obtener el ViewState inicial. Es el
 * cimiento sobre el que se construye todo lo demás (búsqueda, paginación,
 * descarga), porque sin sesión + ViewState válidos el sitio rechaza los POST.
 */
import { createHttpClient } from "./http/client";
import { extractViewStateFromHtml } from "./http/viewState";
import { SEARCH_PAGE_URL } from "./config";

async function main(): Promise<void> {
  const { http, jar } = createHttpClient();

  console.log(`→ GET ${SEARCH_PAGE_URL}`);
  const res = await http.get<string>(SEARCH_PAGE_URL);
  console.log(`  status: ${res.status}`);

  // Verificar que la sesión quedó establecida.
  const cookies = await jar.getCookies(SEARCH_PAGE_URL);
  const jsession = cookies.find((c) => c.key === "JSESSIONID");
  console.log(
    `  sesión: ${jsession ? `JSESSIONID=${jsession.value}` : "⚠️  sin JSESSIONID"}`
  );

  // Extraer el ViewState que necesitaremos para los POST de búsqueda/paginación.
  const viewState = extractViewStateFromHtml(res.data);
  console.log(
    `  ViewState: ${viewState.slice(0, 32)}… (${viewState.length} chars)`
  );

  console.log("✓ Sesión establecida y ViewState extraído correctamente.");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
