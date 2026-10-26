// Vocabulario del módulo Ocio (lado server). El frontend tiene sus etiquetas en web/src/lib/ocio/.

export const WORK_TYPES = ["movie", "series", "book", "game"];
export const ENTRY_STATUSES = ["want", "in_progress", "done", "dropped"];
export const OUTING_STATUSES = ["tentative", "confirmed", "attended", "not_attended"];

/** Unidad de progreso por defecto de cada tipo (página, episodio, horas jugadas, minuto). */
export const DEFAULT_PROGRESS_UNIT = { book: "page", series: "episode", game: "hours", movie: "minute" };

// ---------- equivalencias con el modelo anterior (media_items / outings) ----------
export const LEGACY_TYPE = { pelicula: "movie", serie: "series", libro: "book", videojuego: "game" };
export const LEGACY_STATUS = { pendiente: "want", en_progreso: "in_progress", completado: "done", abandonado: "dropped" };

/** "pág." → page, "hs" → hours, "ep." → episode… (si no se reconoce, la del tipo). */
export function legacyProgressUnit(label, type) {
  const l = (label || "").toLowerCase();
  if (/p[aá]g/.test(l)) return "page";
  if (/hs|hora/.test(l)) return "hours";
  if (/ep|cap/.test(l)) return "episode";
  if (/min/.test(l)) return "minute";
  return DEFAULT_PROGRESS_UNIT[type] ?? "page";
}

// ---------- salidas ----------
export const OUTING_CATEGORIES = ["fiesta", "musica", "celebracion", "deporte", "comida", "cultura", "viaje", "otro"];

const strip = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const CATEGORY_HINTS = [
  ["fiesta", /fiesta|boliche|oktober|after|joda|party/],
  ["musica", /musica|recital|concierto|show|banda|festival|halloween|music/],
  ["celebracion", /cumple|aniversario|celebracion|casamiento|boda|egreso|graduacion|giftbox|gift/],
  ["deporte", /deporte|padel|futbol|tenis|partido|gym|correr|maraton|trekking/],
  ["comida", /comida|cena|almuerzo|asado|resto|restaurant|brunch|merienda|utensils/],
  ["cultura", /teatro|cine|museo|muestra|expo|feria|libro|film/],
  ["viaje", /viaje|escapada|finde largo|vacaciones|^plane$|^mappin$/],
];

/** Categoría a partir de lo que había (texto libre), el título o el ícono que se eligió. */
export function guessOutingCategory({ category, title, icon }) {
  const fromCategory = strip(category);
  if (OUTING_CATEGORIES.includes(fromCategory)) return fromCategory;
  for (const text of [fromCategory, strip(title), strip(icon)]) {
    if (!text) continue;
    const hit = CATEGORY_HINTS.find(([, re]) => re.test(text));
    if (hit) return hit[0];
  }
  return fromCategory ? "otro" : null;
}

/**
 * Estado viejo → nuevo. "planeado" pasa a confirmado, salvo que el título o las notas digan que
 * no estaba confirmado ("?", "sin confirmar", "tentativo"); "cancelado" queda como no fui.
 */
export function legacyOutingStatus({ status, title, notes }) {
  if (status === "hecho") return "attended";
  if (status === "cancelado") return "not_attended";
  const doubtful = /\?/.test(title || "") || /sin confirmar|tentativ|capaz|quiz[aá]s/i.test(notes || "");
  return doubtful ? "tentative" : "confirmed";
}
