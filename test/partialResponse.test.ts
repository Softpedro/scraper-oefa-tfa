/**
 * Tests del parseo del XML <partial-response> de PrimeFaces.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { parsePartialResponse } from "../src/http/partialResponse";

const SAMPLE = `<?xml version='1.0' encoding='UTF-8'?>
<partial-response id="j_id1">
  <changes>
    <update id="listarDetalleInfraccionRAAForm:pgLista"><![CDATA[<div id="tabla">filas</div>]]></update>
    <update id="j_id1:javax.faces.ViewState:0"><![CDATA[NUEVO_VIEWSTATE_999]]></update>
  </changes>
</partial-response>`;

test("extrae los updates por id y el ViewState nuevo", () => {
  const res = parsePartialResponse(SAMPLE);

  assert.equal(
    res.updates.get("listarDetalleInfraccionRAAForm:pgLista"),
    '<div id="tabla">filas</div>'
  );
  assert.equal(res.viewState, "NUEVO_VIEWSTATE_999");
});

test("lanza error si la respuesta no trae ViewState (sesión caída)", () => {
  const xml = `<?xml version='1.0' encoding='UTF-8'?>
    <partial-response id="j_id1"><changes>
      <update id="algo"><![CDATA[x]]></update>
    </changes></partial-response>`;

  assert.throws(() => parsePartialResponse(xml), /ViewState/);
});
