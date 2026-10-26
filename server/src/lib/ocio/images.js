// Galería: reconocer imágenes por su contenido (no por la extensión), leer sus medidas, numerar
// el inventario y armar la rotación del atril. Funciones puras, sin base de datos.

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_THUMB_BYTES = 2 * 1024 * 1024;
export const MAX_SIDE = 12_000;

/** Tipo real de la imagen según los primeros bytes (PNG, JPEG o GIF); null si es otra cosa. */
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString("latin1", 1, 8) === "PNG\r\n\x1a\n") return { mime: "image/png", ext: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  const gif = buf.toString("latin1", 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return { mime: "image/gif", ext: "gif" };
  return null;
}

/** Ancho y alto leyendo la cabecera; null si no se pudo. */
export function imageSize(buf, mime) {
  try {
    if (mime === "image/png") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (mime === "image/gif") return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) return null;
        const marker = buf[i + 1];
        if (marker === 0xff) {
          i += 1; // relleno
          continue;
        }
        // SOF0..SOF15 (menos DHT, JPG y DAC) traen las medidas.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch {
    // cabecera cortada
  }
  return null;
}

/**
 * Valida una imagen subida: tipo real, peso y medidas. Devuelve { mime, ext, width, height } o
 * tira un error con status 4xx y un mensaje para mostrar.
 */
export function validateImage(buf, { maxBytes = MAX_IMAGE_BYTES } = {}) {
  const fail = (status, error, message) => Object.assign(new Error(error), { status, userMessage: message });
  if (!buf?.length) throw fail(400, "image_required", "Elegí una imagen.");
  if (buf.length > maxBytes) throw fail(413, "too_large", `La imagen pesa más de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const kind = sniffImage(buf);
  if (!kind) throw fail(415, "unsupported_type", "Solo PNG, JPG o GIF.");
  const size = imageSize(buf, kind.mime);
  if (!size || !size.width || !size.height) throw fail(422, "unreadable_image", "No se pudo leer la imagen (¿está dañada?).");
  if (size.width > MAX_SIDE || size.height > MAX_SIDE) throw fail(422, "too_big", `La imagen supera los ${MAX_SIDE} px de lado.`);
  return { ...kind, ...size };
}

/** Siguiente código de inventario: PX-001, PX-002… (sigue al número más alto que ya exista). */
export function nextInventoryCode(codes, prefix = "PX") {
  const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
  const max = codes.reduce((m, c) => Math.max(m, Number(re.exec(c || "")?.[1] ?? 0)), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------------------------
// Atril: qué obras rotan y en qué orden.

export const EASEL_INTERVALS = { "6s": 6_000, "15s": 15_000, "1m": 60_000, daily: null };
export const EASEL_ORDERS = ["chronological", "random", "favorites"];
export const EASEL_DEFAULTS = { interval: "15s", order: "chronological", showOnHome: true };

/** Normaliza la configuración guardada (valores desconocidos → por defecto). */
export function easelSettings(raw = {}) {
  return {
    interval: raw.interval in EASEL_INTERVALS ? raw.interval : EASEL_DEFAULTS.interval,
    order: EASEL_ORDERS.includes(raw.order) ? raw.order : EASEL_DEFAULTS.order,
    showOnHome: raw.showOnHome == null ? EASEL_DEFAULTS.showOnHome : raw.showOnHome === true || raw.showOnHome === "1" || raw.showOnHome === "true",
  };
}

/** Número pseudoaleatorio estable a partir de un texto (para que "aleatorio" no salte en cada recarga). */
function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const createdKey = (a) => a.createdOn || String(a.createdAt || "").slice(0, 10);

/**
 * Obras del atril en orden: solo las marcadas "mostrar en el atril"; cronológico (de la más vieja
 * a la más nueva), aleatorio (mezcla fija por `seed`, p. ej. el día) o solo favoritas (si no hay
 * favoritas, todas, para que el atril nunca quede vacío teniendo obras).
 */
export function easelSequence(artworks, { order = "chronological", seed = "" } = {}) {
  let list = artworks.filter((a) => a.showOnEasel);
  if (order === "favorites") {
    const favs = list.filter((a) => a.isFavorite);
    if (favs.length) list = favs;
  }
  list = [...list].sort((a, b) => createdKey(a).localeCompare(createdKey(b)) || a.id - b.id);
  if (order === "random") {
    const rnd = seeded(seed);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  return list;
}

/** Con "una por día": qué obra toca hoy (avanza una por día, en orden). */
export function dailyIndex(length, today) {
  if (!length) return 0;
  const [y, m, d] = today.split("-").map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return day % length;
}
