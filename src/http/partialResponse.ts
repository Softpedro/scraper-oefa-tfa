/**
 * Parseo de respuestas AJAX de PrimeFaces (`<partial-response>`).
 *
 * Cuando se dispara una acción AJAX (búsqueda, paginación), el servidor NO
 * devuelve HTML normal sino un XML como:
 *
 *   <partial-response id="j_id1">
 *     <changes>
 *       <update id="...:pgLista"><![CDATA[ <div>...la tabla... </div> ]]></update>
 *       <update id="j_id1:javax.faces.ViewState:0"><![CDATA[ nuevo-viewstate ]]></update>
 *     </changes>
 *   </partial-response>
 *
 * Cada `<update>` trae, dentro de un CDATA, un fragmento HTML (o el ViewState).
 */
import * as cheerio from "cheerio";

export interface PartialResponse {
  /** Mapa id-del-update → contenido (HTML o texto). */
  updates: Map<string, string>;
  /** El ViewState nuevo, que debe usarse en la siguiente petición. */
  viewState: string;
}

/**
 * Parsea un XML `<partial-response>` y devuelve sus updates + el nuevo ViewState.
 * @throws si el XML no trae ViewState (señal de sesión caída o respuesta de error).
 */
export function parsePartialResponse(xml: string): PartialResponse {
  const $ = cheerio.load(xml, { xmlMode: true });

  const updates = new Map<string, string>();
  $("update").each((_, el) => {
    const id = $(el).attr("id");
    if (id) {
      updates.set(id, $(el).text());
    }
  });

  // El update del ViewState tiene un id del tipo "j_id1:javax.faces.ViewState:0".
  let viewState: string | undefined;
  for (const [id, content] of updates) {
    if (id.includes("javax.faces.ViewState")) {
      viewState = content;
      break;
    }
  }

  if (!viewState) {
    throw new Error(
      "La respuesta <partial-response> no contiene ViewState. " +
        "¿Se perdió la sesión o el servidor devolvió un error?"
    );
  }

  return { updates, viewState };
}
