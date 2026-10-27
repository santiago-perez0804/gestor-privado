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
 * Solo se bajan portadas de los servidores de imágenes de los catálogos (y por HTTPS). Así el
 * server no puede usarse para pedir otras direcciones (la red de la casa, localhost, etc.): la URL
 * de la portada viene del navegador y no hay que confiar en ella.
 */
const COVER_HOSTS = ["image.tmdb.org", "covers.openlibrary.org", "archive.org", "books.google.com", "books.googleusercontent.com", "media.rawg.io"];
export function isAllowedCoverUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  return u.protocol === "https:" && !u.username && !u.password && (u.port === "" || u.port === "443") && COVER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Descarga `url` y la guarda como `<workId>-<hash>.<ext>`. Devuelve el nombre del archivo
 * (relativo a coversDir) o null si no es una imagen válida o el origen no está permitido.
 * Las redirecciones se siguen a mano (Open Library redirige a archive.org) y cada salto se
 * vuelve a validar.
 */
export async function downloadCover(url, workId, coversDir, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  let current = String(url || "");
  let res = null;
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedCoverUrl(current)) return null;
    res = await fetchImpl(current, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) break;
    current = new URL(location, current).toString();
    res = null;
  }
  if (!res?.ok) return null;
  const declared = Number(res.headers.get("content-length"));
  if (declared > MAX_BYTES) return null;
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
