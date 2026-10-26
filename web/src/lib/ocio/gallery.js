// Galería: validar archivos antes de subirlos, armar la miniatura en el navegador y las opciones
// del atril. Lo que se puede testear en Node no usa el DOM.

export const MAX_IMAGE_MB = 20;
export const THUMB_MAX_SIDE = 480;

export const EASEL_INTERVALS = [
  { id: "6s", label: "Cada 6 s", ms: 6_000 },
  { id: "15s", label: "Cada 15 s", ms: 15_000 },
  { id: "1m", label: "Cada 1 min", ms: 60_000 },
  { id: "daily", label: "Una por día", ms: null },
];
export const EASEL_ORDERS = [
  { id: "chronological", label: "Cronológico" },
  { id: "random", label: "Aleatorio" },
  { id: "favorites", label: "Solo favoritas" },
];
export const intervalMs = (id) => EASEL_INTERVALS.find((i) => i.id === id)?.ms ?? null;

/** Tipo real según los primeros bytes (igual que el server): "image/png" | "image/jpeg" | "image/gif" | null. */
export function sniffBytes(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 6) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  const head = String.fromCharCode(...b.slice(0, 6));
  if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  return null;
}

/** Revisa un archivo antes de subirlo: tipo real y peso. Devuelve { mime } o { error }. */
export async function checkImageFile(file) {
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return { error: `${file.name}: pesa más de ${MAX_IMAGE_MB} MB.` };
  const mime = sniffBytes(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!mime) return { error: `${file.name}: no es PNG, JPG ni GIF.` };
  return { mime };
}

/** Medidas de la miniatura: entra en `max` × `max` sin agrandar. null si no hace falta miniatura. */
export function thumbSize(width, height, max = THUMB_MAX_SIDE) {
  const side = Math.max(width, height);
  if (side <= max) return null;
  const k = max / side;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/**
 * Miniatura PNG armada con canvas y SIN suavizado (para que el pixel art no se vuelva borroso).
 * Solo para imágenes grandes: las chicas se muestran directo desde el original.
 * @returns {Promise<{ blob: Blob|null, width: number, height: number }>}
 */
export async function makeThumbnail(file) {
  const bitmap = await createImageBitmap(file);
  const size = thumbSize(bitmap.width, bitmap.height);
  if (!size) return { blob: null, width: bitmap.width, height: bitmap.height };
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return { blob, width: bitmap.width, height: bitmap.height };
}

/**
 * Cómo escalar: pixelado (sin difuminar) salvo las fotos grandes en JPG, que se verían
 * serruchadas al achicarlas.
 */
export const imageRendering = (art) => (art?.mime === "image/jpeg" && Math.max(art.width || 0, art.height || 0) > 1024 ? "auto" : "pixelated");

/** "PX-004 · Aseprite · 2026" para el rótulo del museo. */
export function artworkCaption(art) {
  return [art.technique, art.createdOn?.slice(0, 4), art.sizeLabel].filter(Boolean).join(" · ");
}
