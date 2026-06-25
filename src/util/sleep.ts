/** Pausa la ejecución `ms` milisegundos (para los delays entre peticiones). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
