// Portadas: al agregar una obra se descarga la imagen y se guarda en data/covers, así la
// biblioteca se ve sin red y no depende de que el catálogo siga sirviendo esa URL.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const MAX_BYTES = 5 * 1024 * 1024;

/** Tipo de imagen por los primeros bytes (no confiamos en el content-type ni en la extensión). */
export function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return "png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length > 6 && buf.toString("ascii", 0, 3) === "GIF") return "gif";
  return null;
}

/**
 * Descarga `url` y la guarda como `<workId>-<hash>.<ext>`. Devuelve el nombre del archivo
 * (relativo a coversDir) o null si no es una imagen válida.
 */
export async function downloadCover(url, workId, coversDir, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) return null;
  const ext = sniffImage(buf);
  if (!ext) return null;
  // Open Library devuelve un GIF de 1×1 cuando no tiene portada: no sirve.
  if (ext === "gif" && buf.length < 100) return null;
  const name = `${workId}-${createHash("sha1").update(buf).digest("hex").slice(0, 10)}.${ext}`;
  writeFileSync(join(coversDir, name), buf);
  return name;
}
