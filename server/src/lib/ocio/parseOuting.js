// Carga rápida de salidas en lenguaje natural (español rioplatense), sin LLM:
//   "recital en Quality el sábado 14 a las 21" → { title: "Recital", place: "Quality",
//    date: "2026-11-14", startTime: "21:00", category: "musica" }
// Devuelve también `warnings` (p. ej. si el 14 no cae sábado) para mostrarlos en la vista previa.
import { guessOutingCategory } from "./constants.js";

const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTHS = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Próximo día de la semana `dow` desde `from` (hoy cuenta si `includeToday`). */
function nextWeekday(from, dow, includeToday = true) {
  const diff = (dow - from.getDay() + 7) % 7;
  return addDays(from, diff === 0 && !includeToday ? 7 : diff);
}

/** Próxima fecha (desde hoy) con ese día del mes; si se pide día de la semana, que coincida. */
function nextDayOfMonth(from, day, dow = null) {
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(from.getFullYear(), from.getMonth() + i, day);
    if (candidate.getDate() !== day || candidate < from) continue;
    if (dow == null || candidate.getDay() === dow) return candidate;
  }
  return null;
}

/** Saca del texto el primer patrón que coincide y devuelve el match. */
function take(state, re) {
  const m = state.rest.match(re);
  if (m) state.rest = (state.rest.slice(0, m.index) + " " + state.rest.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
  return m;
}

/** "21" → "21:00", "9" + "noche" → "21:00", "9.30" → "09:30". */
function toTime(h, m = 0, period = null) {
  let hour = Number(h);
  const minute = Number(m) || 0;
  if (period && /noche|tarde|pm/.test(period) && hour < 12) hour += 12;
  if (period && /mañana|manana|am/.test(period) && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

/**
 * @param {string} text
 * @param {string} today YYYY-MM-DD (fecha local)
 * @returns {{ title: string, date: string|null, startTime: string|null, place: string|null,
 *   withWhom: string|null, category: string|null, warnings: string[] }}
 */
export function parseOuting(text, today) {
  const base = new Date(`${today}T00:00:00`);
  // Se trabaja sobre el texto sin tildes y en minúscula para buscar, pero el lugar y las personas
  // se recortan del original para conservar mayúsculas.
  const original = String(text || "").trim();
  const state = { rest: stripAccents(original).toLowerCase() };
  const warnings = [];
  let date = null;
  let startTime = null;

  // ---------- hora ----------
  const time =
    take(state, /\b(?:a las|a la|tipo|desde las|desde la)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs?|horas?)?\s*(?:de la\s+)?(manana|tarde|noche|am|pm)?\b/) ||
    take(state, /\b(\d{1,2})[:.](\d{2})\s*(?:hs?)?\b/) ||
    take(state, /\b(\d{1,2})\s*(?:hs|h)\b\s*(?:de la\s+)?(manana|tarde|noche)?/);
  if (time) {
    const [, h, mOrPeriod, period] = time;
    const minute = /^\d+$/.test(mOrPeriod || "") ? mOrPeriod : 0;
    startTime = toTime(h, minute, period || (/^\D+$/.test(mOrPeriod || "") ? mOrPeriod : null));
  }

  // ---------- fecha ----------
  const weekdayNames = Object.keys(WEEKDAYS).join("|");
  const monthNames = Object.keys(MONTHS).join("|");
  let m;
  if ((m = take(state, /\bpasado manana\b/))) date = addDays(base, 2);
  else if ((m = take(state, /\bmanana\b/))) date = addDays(base, 1);
  else if ((m = take(state, /\bhoy\b|\besta noche\b/))) date = base;
  else if ((m = take(state, new RegExp(`\\b(\\d{1,2}) de (${monthNames})(?: de (\\d{4}))?\\b`)))) {
    const year = m[3] ? Number(m[3]) : base.getFullYear();
    date = new Date(year, MONTHS[m[2]], Number(m[1]));
    if (!m[3] && date < base) date = new Date(year + 1, MONTHS[m[2]], Number(m[1]));
  } else if ((m = take(state, /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : base.getFullYear();
    date = new Date(year, Number(m[2]) - 1, Number(m[1]));
    if (!m[3] && date < base) date = new Date(year + 1, Number(m[2]) - 1, Number(m[1]));
  } else if ((m = take(state, new RegExp(`\\b(?:el |este |esta |el proximo |proximo )?(${weekdayNames})(?: (\\d{1,2}))?\\b`)))) {
    const dow = WEEKDAYS[m[1]];
    if (m[2]) {
      date = nextDayOfMonth(base, Number(m[2]), dow);
      if (date && (date - base) / 86_400_000 > 60) warnings.push(`El próximo ${m[1]} ${m[2]} recién es el ${fmt(date)}: ¿era otro día?`);
      if (!date) {
        date = nextDayOfMonth(base, Number(m[2]));
        warnings.push(`El ${m[2]} no cae ${m[1]} en los próximos meses: usé el ${m[2]} igual.`);
      }
    } else date = nextWeekday(base, dow, !/proximo/.test(m[0]));
  } else if ((m = take(state, /\b(?:este |el )?finde\b|\bfin de semana\b/))) date = nextWeekday(base, 6);
  else if ((m = take(state, /\bel (\d{1,2})\b/))) {
    date = nextDayOfMonth(base, Number(m[1]));
  }
  if (date && date.getFullYear() > base.getFullYear() + 1) warnings.push("La fecha quedó muy lejos: revisala.");

  // ---------- con quién ----------
  const withMatch = take(state, /\bcon ([a-z0-9ñ ]+?)(?= en | el | a las | hoy| manana|$)/);
  const withWhom = withMatch ? recoverCase(original, withMatch[1]) : null;

  // ---------- lugar ----------
  const placeMatch = take(state, /\b(?:en|@)\s+([a-z0-9ñ'&. ]+?)(?= con | el | a las | hoy| manana|$)/);
  const place = placeMatch ? recoverCase(original, placeMatch[1]) : null;

  // ---------- título: lo que queda ----------
  const leftover = state.rest.replace(/\b(el|la|los|las|de|del|a|y)$/g, "").replace(/^(el|la|un|una)\s+/, "").trim();
  const title = cap(recoverCase(original, leftover) || "Salida");

  return {
    title,
    date: date ? fmt(date) : null,
    startTime,
    place,
    withWhom,
    category: guessOutingCategory({ title: `${title} ${place || ""}` }),
    warnings,
  };
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Recupera mayúsculas/tildes del texto original para un fragmento encontrado sin ellas. */
function recoverCase(original, fragment) {
  const f = (fragment || "").trim();
  if (!f) return "";
  const plain = stripAccents(original).toLowerCase();
  const i = plain.indexOf(f);
  return i >= 0 ? original.slice(i, i + f.length).trim() : f;
}
