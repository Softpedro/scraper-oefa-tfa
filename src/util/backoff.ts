/**
 * Reintentos con backoff exponencial.
 *
 * Pensado sobre todo para los 429 (Too Many Requests): cuando el servidor pide
 * que bajemos el ritmo, esperamos un tiempo creciente (base·2^n) con un poco de
 * jitter para no reintentar todos a la vez. También cubre 5xx y errores de red
 * transitorios (timeouts, conexiones cortadas).
 */
import { isAxiosError } from "axios";

import { sleep } from "./sleep";

export interface RetryInfo {
  /** Número de intento que acaba de fallar (1-based). */
  attempt: number;
  /** Milisegundos que se esperarán antes del siguiente intento. */
  delayMs: number;
  /** Código HTTP de la respuesta, si hubo. */
  status?: number;
  error: unknown;
}

export interface RetryOptions {
  /** Máximo de reintentos (sin contar el intento inicial). Default 5. */
  retries?: number;
  /** Delay base del backoff (ms). Default 1000. */
  baseDelayMs?: number;
  /** Tope del delay (ms). Default 30000. */
  maxDelayMs?: number;
  /** Se invoca antes de cada espera (para loguear el reintento). */
  onRetry?: (info: RetryInfo) => void;
}

/** Códigos que vale la pena reintentar: rate limiting y errores de servidor. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Decide si un error amerita reintento y, si el servidor lo indicó, cuánto
 * esperar (cabecera `Retry-After`, en segundos).
 */
function classify(error: unknown): {
  retryable: boolean;
  status?: number;
  retryAfterMs?: number;
} {
  if (!isAxiosError(error)) {
    // No es un error HTTP conocido: probablemente algo no recuperable.
    return { retryable: false };
  }

  const status = error.response?.status;

  // Sin respuesta = problema de red/timeout (ECONNRESET, ETIMEDOUT): reintentable.
  if (status === undefined) return { retryable: true };

  if (!RETRYABLE_STATUS.has(status)) return { retryable: false, status };

  // Algunos servidores acompañan el 429 con Retry-After (segundos). Lo honramos.
  let retryAfterMs: number | undefined;
  const retryAfter = error.response?.headers?.["retry-after"];
  if (retryAfter !== undefined) {
    const secs = Number(retryAfter);
    if (!Number.isNaN(secs)) retryAfterMs = secs * 1000;
  }

  return { retryable: true, status, retryAfterMs };
}

/**
 * Ejecuta `fn` reintentando con backoff exponencial ante errores transitorios.
 * Re-lanza el último error si se agotan los reintentos o si no es reintentable.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 5,
    baseDelayMs = 1_000,
    maxDelayMs = 30_000,
    onRetry,
  } = options;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      const { retryable, status, retryAfterMs } = classify(error);
      if (!retryable || attempt > retries) throw error;

      // Backoff exponencial: base·2^(n-1), con tope y un 25% de jitter.
      const expo = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(expo * 0.25 * Math.random());
      const delayMs = retryAfterMs ?? expo + jitter;

      onRetry?.({ attempt, delayMs, status, error });
      await sleep(delayMs);
    }
  }
}
