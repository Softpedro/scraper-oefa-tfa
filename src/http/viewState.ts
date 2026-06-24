/**
 * Extracción del `javax.faces.ViewState`.
 *
 * El ViewState es un token que JSF exige en cada POST. Cambia con cada
 * respuesta, así que hay que volver a leerlo después de cada petición.
 *
 * En el HTML inicial (GET) viene como un input hidden:
 *   <input name="javax.faces.ViewState" id="..." value="EL_TOKEN">
 */
import * as cheerio from "cheerio";

const VIEWSTATE_INPUT = 'input[name="javax.faces.ViewState"]';

/**
 * Lee el ViewState desde el HTML de una página completa.
 * @throws si no lo encuentra (señal de que la página cambió o falló la sesión).
 */
export function extractViewStateFromHtml(html: string): string {
  const $ = cheerio.load(html);
  const value = $(VIEWSTATE_INPUT).attr("value");

  if (!value) {
    throw new Error(
      "No se encontró 'javax.faces.ViewState' en el HTML. " +
        "¿Cambió la página o se perdió la sesión?"
    );
  }

  return value;
}
