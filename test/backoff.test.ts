/**
 * Tests del reintento con backoff exponencial (manejo de 429 / 5xx / red).
 *
 * Se usan delays mínimos (baseDelayMs: 1) para que los tests sean rápidos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { withRetry } from "../src/util/backoff";

/** Fabrica un error con la forma que reconoce axios.isAxiosError. */
function axiosError(status?: number, headers: Record<string, string> = {}) {
  return {
    isAxiosError: true,
    response: status === undefined ? undefined : { status, headers },
  };
}

const FAST = { baseDelayMs: 1, maxDelayMs: 2 };

test("reintenta ante 429 y termina devolviendo el resultado", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 3) throw axiosError(429);
    return "ok";
  }, FAST);

  assert.equal(result, "ok");
  assert.equal(calls, 3); // 2 fallos + 1 éxito
});

test("no reintenta ante un error no recuperable (404)", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls++;
      throw axiosError(404);
    }, FAST)
  );
  assert.equal(calls, 1); // se rinde de inmediato
});

test("se rinde tras agotar los reintentos y re-lanza el error", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls++;
      throw axiosError(503);
    }, { ...FAST, retries: 2 })
  );
  assert.equal(calls, 3); // intento inicial + 2 reintentos
});

test("reintenta ante errores de red (sin response)", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 2) throw axiosError(undefined); // timeout / ECONNRESET
    return 42;
  }, FAST);

  assert.equal(result, 42);
  assert.equal(calls, 2);
});

test("invoca onRetry en cada reintento con el status", async () => {
  const seen: Array<number | undefined> = [];
  let calls = 0;
  await withRetry(async () => {
    calls++;
    if (calls < 3) throw axiosError(429);
    return "ok";
  }, {
    ...FAST,
    onRetry: ({ status }) => seen.push(status),
  });

  assert.deepEqual(seen, [429, 429]);
});
