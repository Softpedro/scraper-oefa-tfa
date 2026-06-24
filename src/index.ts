/**
 * Punto de entrada del scraper.
 *
 * Por ahora es un esqueleto: la lógica de navegación, extracción y descarga
 * se irá agregando por fases (ver README y docs/recon.md).
 */
async function main(): Promise<void> {
  console.log("Scraper OEFA/TFA — setup inicial OK. Lógica pendiente.");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
