// Utilidades de los servicios de Físico: errores con status, JSON en columnas, ajustes y "hoy".
import { mergeSettings } from "../../../../shared/fisico/constants.js";
import { localDate } from "../../../../shared/fisico/dates.js";

export const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
export const notFound = (msg = "not_found") => Object.assign(new Error(msg), { status: 404 });
export const conflict = (msg) => Object.assign(new Error(msg), { status: 409 });
export const nowIso = () => new Date().toISOString();

export const parseJson = (text, fallback) => {
  if (text == null || text === "") return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const SETTINGS_KEY = "fisico.settings";

/** Ajustes efectivos de Físico (los guardados encima de los por defecto). */
export function getSettings(db) {
  const raw = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY)?.value;
  return mergeSettings(parseJson(raw, {}));
}

/** Guarda cambios de ajustes (solo claves conocidas) y devuelve los efectivos. */
export function saveSettings(db, patch = {}) {
  const current = parseJson(db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY)?.value, {});
  const next = { ...current };
  const defaults = mergeSettings({});
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in defaults)) continue;
    next[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...(current[k] || {}), ...v } : v;
  }
  if ("heightCm" in next && next.heightCm != null && !(Number(next.heightCm) > 50 && Number(next.heightCm) < 260)) throw bad("invalid_height");
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(SETTINGS_KEY, JSON.stringify(next));
  return getSettings(db);
}

/** Hoy en la zona horaria del usuario (no la del equipo). */
export const today = (db) => localDate(new Date(), getSettings(db).timeZone);
