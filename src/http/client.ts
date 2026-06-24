/**
 * Cliente HTTP con soporte de sesión.
 *
 * El sitio es JSF/PrimeFaces: mantiene el estado en una sesión identificada por
 * la cookie `JSESSIONID`. Por eso usamos un "cookie jar" (tough-cookie) que
 * guarda y reenvía las cookies automáticamente en cada petición, igual que lo
 * haría un navegador.
 */
import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

import { USER_AGENT, REQUEST_TIMEOUT_MS } from "../config";

export interface HttpClient {
  /** Instancia de axios con cookie jar ya integrado. */
  http: AxiosInstance;
  /** El "frasco" de cookies de la sesión (para inspeccionar JSESSIONID, etc.). */
  jar: CookieJar;
}

/**
 * Crea un cliente HTTP nuevo con su propia sesión (cookie jar aislado).
 */
export function createHttpClient(): HttpClient {
  const jar = new CookieJar();

  const http = wrapper(
    axios.create({
      timeout: REQUEST_TIMEOUT_MS,
      // Cabeceras de navegador. El Accept con XML es importante porque las
      // respuestas AJAX de PrimeFaces vienen como <partial-response> (XML).
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
      },
    })
  );

  // El cookie jar se reenvía en cada petición a través de los defaults.
  // El tipo `jar` lo aporta nuestra augmentación en src/types/axios.d.ts.
  http.defaults.jar = jar;

  return { http, jar };
}
