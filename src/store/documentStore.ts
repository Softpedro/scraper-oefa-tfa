/**
 * Almacén de documentos extraídos.
 *
 * Persiste los documentos en `output/data.json`. Mantiene un índice en memoria
 * para deduplicar (por si se reprocesa una página) y reescribe el archivo
 * completo en cada guardado — el volumen es pequeño (miles de filas), así que
 * es simple y seguro.
 */
import * as fs from "fs";
import * as path from "path";

import { OUTPUT_DIR } from "../config";
import { Documento } from "../parser/types";

const DATA_FILE = path.join(OUTPUT_DIR, "data.json");

/** Clave única de un documento: el UUID del PDF si existe; si no, nro+expediente. */
function keyOf(d: Documento): string {
  return d.pdfUuid ?? `${d.nro}|${d.expediente}`;
}

export class DocumentStore {
  private docs = new Map<string, Documento>();

  /** Carga lo ya guardado (para reanudar sin perder lo previo). */
  load(): void {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const arr = JSON.parse(raw) as Documento[];
      for (const d of arr) this.docs.set(keyOf(d), d);
    } catch {
      // Aún no existe el archivo: empezamos vacíos.
    }
  }

  /** Agrega/actualiza documentos en el índice en memoria. */
  add(docs: Documento[]): void {
    for (const d of docs) this.docs.set(keyOf(d), d);
  }

  /** Escribe el archivo data.json con todo lo acumulado. */
  save(): void {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const arr = [...this.docs.values()];
    fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), "utf8");
  }

  /** Devuelve todos los documentos almacenados. */
  all(): Documento[] {
    return [...this.docs.values()];
  }

  get size(): number {
    return this.docs.size;
  }
}
