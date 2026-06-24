/**
 * Augmentación de tipos para axios.
 *
 * `axios-cookiejar-support` agrega la propiedad `jar` a la config de axios,
 * pero su augmentación se pierde al compilar con `skipLibCheck` (el error de
 * merge dentro de node_modules queda silenciado). La replicamos aquí, dentro
 * del proyecto, para poder usar `jar` con tipado correcto.
 */
import type { CookieJar } from "tough-cookie";

declare module "axios" {
  interface AxiosRequestConfig<D = any> {
    jar?: CookieJar;
  }
}
