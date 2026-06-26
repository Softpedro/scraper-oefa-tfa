/**
 * Descarga del PDF de un documento.
 *
 * El enlace de la columna "Archivo" NO es AJAX: dispara `mojarra.jsfcljs`, que
 * arma un form oculto y lo envía como POST `x-www-form-urlencoded`. La respuesta
 * es el binario (`application/octet-stream`) con el nombre real en la cabecera
 * `Content-Disposition`. No devuelve ViewState (es un full postback que termina
 * en `responseComplete`), por eso hay que descargar con el ViewState de la
 * página donde está la fila.
 */
import * as fs from "fs";
import * as path from "path";

import { AxiosInstance } from "axios";

import { PDF_DIR, SEARCH_PAGE_URL } from "../config";
import { Documento } from "../parser/types";
import { FORM_ID } from "./search";

const DOWNLOAD_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
};

/**
 * Campos de texto vacíos del formulario (Administrado, Unidad fiscalizable,
 * Nro. Resolución). El navegador los serializa al enviar el form completo; los
 * replicamos para mandar exactamente el mismo POST que el sitio real.
 */
const EMPTY_FORM_FIELDS: Record<string, string> = {
  [`${FORM_ID}:j_idt21`]: "",
  [`${FORM_ID}:j_idt25`]: "",
  [`${FORM_ID}:j_idt34`]: "",
};

export interface DownloadParams {
  /** Sector activo en la búsqueda ("" = Todos). Va en el form como `idsector`. */
  sector?: string;
  /** Texto del campo expediente (normalmente vacío). */
  expediente?: string;
}

export interface DownloadResult {
  /** Nombre con el que se guardó el archivo. */
  fileName: string;
  /** Ruta completa en disco. */
  filePath: string;
  /** Tamaño en bytes. */
  bytes: number;
}

/**
 * Descarga el PDF de `doc` usando `viewState` (el de la página donde está la
 * fila) y lo guarda en la carpeta de PDFs con su nombre descriptivo.
 *
 * @throws si el documento no tiene PDF, o si la respuesta no es un binario
 *   (p. ej. el servidor devolvió HTML por un ViewState vencido).
 */
export async function downloadPdf(
  http: AxiosInstance,
  viewState: string,
  doc: Documento,
  params: DownloadParams = {}
): Promise<DownloadResult> {
  if (!doc.pdfUuid || !doc.pdfSourceId) {
    throw new Error(`El documento ${doc.expediente} no tiene PDF asociado.`);
  }

  const body = new URLSearchParams({
    [FORM_ID]: FORM_ID,
    [`${FORM_ID}:txtNroexp`]: params.expediente ?? "",
    ...EMPTY_FORM_FIELDS,
    [`${FORM_ID}:idsector`]: params.sector ?? "",
    [`${FORM_ID}:dt_scrollState`]: "0,0",
    "javax.faces.ViewState": viewState,
    // El source del link va repetido como clave=valor (lo que hace mojarra).
    [doc.pdfSourceId]: doc.pdfSourceId,
    param_uuid: doc.pdfUuid,
  }).toString();

  const res = await http.post<ArrayBuffer>(SEARCH_PAGE_URL, body, {
    headers: DOWNLOAD_HEADERS,
    responseType: "arraybuffer",
  });

  // Si nos devuelven HTML/XML en vez del binario, algo falló (ViewState vencido,
  // sesión caída, etc.). Lo tratamos como error para que entre al log de fallidos.
  const contentType = String(res.headers["content-type"] ?? "");
  if (/text\/(html|xml)/i.test(contentType)) {
    throw new Error(
      `Respuesta no-PDF para ${doc.expediente} (content-type: ${contentType}). ` +
        "Posible ViewState vencido o sesión caída."
    );
  }

  const fileName = sanitizeFileName(
    fileNameFromDisposition(res.headers["content-disposition"]) ??
      fallbackName(doc)
  );

  fs.mkdirSync(PDF_DIR, { recursive: true });
  const filePath = path.join(PDF_DIR, fileName);
  const buffer = Buffer.from(res.data);
  fs.writeFileSync(filePath, buffer);

  return { fileName, filePath, bytes: buffer.length };
}

/**
 * Saca el nombre del archivo de la cabecera `Content-Disposition`. Soporta tanto
 * `filename="..."` como la forma extendida `filename*=UTF-8''...`.
 */
function fileNameFromDisposition(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const extended = value.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].replace(/^"|"$/g, ""));
    } catch {
      // Si la decodificación falla, caemos al filename simple.
    }
  }

  const simple = value.match(/filename="?([^";]+)"?/i);
  return simple ? simple[1].trim() : null;
}

/** Nombre de respaldo si no vino `Content-Disposition`: expediente + resolución. */
function fallbackName(doc: Documento): string {
  const base =
    [doc.expediente, doc.nroResolucion].filter(Boolean).join("_") ||
    doc.pdfUuid ||
    "documento";
  return `${base}.pdf`;
}

/**
 * Deja un nombre de archivo seguro: reemplaza separadores de ruta y caracteres
 * inválidos, conserva acentos/° y garantiza la extensión .pdf.
 */
function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[/\\]+/g, "-")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f<>:"|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const safe = cleaned || "documento";
  return /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`;
}
