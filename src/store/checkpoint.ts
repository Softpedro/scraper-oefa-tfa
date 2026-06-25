/**
 * Checkpoint para reanudar el scraping.
 *
 * Guarda en `output/checkpoint.json` la última página completada. Si el proceso
 * se corta (caída, Ctrl-C, error de red), la siguiente corrida retoma desde la
 * página siguiente en lugar de empezar de cero.
 */
import * as fs from "fs";
import * as path from "path";

import { OUTPUT_DIR } from "../config";

const CHECKPOINT_FILE = path.join(OUTPUT_DIR, "checkpoint.json");

export interface Checkpoint {
  /** Última página recorrida y guardada con éxito. */
  lastCompletedPage: number;
  totalPages: number;
  totalRecords: number;
  /** Sector usado en la búsqueda ("" = Todos). Evita reanudar con otro filtro. */
  sector: string;
  /** Marca de tiempo del último guardado (ISO). */
  updatedAt: string;
}

export function readCheckpoint(): Checkpoint | null {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8")) as Checkpoint;
  } catch {
    return null;
  }
}

export function writeCheckpoint(cp: Checkpoint): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), "utf8");
}

export function clearCheckpoint(): void {
  try {
    fs.unlinkSync(CHECKPOINT_FILE);
  } catch {
    // Si no existe, nada que limpiar.
  }
}
