/**
 * Tests de la extracción del ViewState desde el HTML inicial.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { extractViewStateFromHtml } from "../src/http/viewState";

test("extrae el value del input javax.faces.ViewState", () => {
  const html = `
    <html><body>
      <form id="f">
        <input type="hidden" name="javax.faces.ViewState"
               id="j_id1:javax.faces.ViewState:0" value="ABC123token" />
      </form>
    </body></html>`;

  assert.equal(extractViewStateFromHtml(html), "ABC123token");
});

test("lanza error si no hay ViewState en el HTML", () => {
  const html = "<html><body><form></form></body></html>";
  assert.throws(() => extractViewStateFromHtml(html), /ViewState/);
});
