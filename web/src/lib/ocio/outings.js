// Salidas: categorías, estados y fechas legibles.
import { MONTHS_ES, MONTHS_ES_ABBR } from "../billing.js";

export const OUTING_CATEGORIES = {
  fiesta: { label: "Fiesta", color: "#d4a23c" },
  musica: { label: "Música", color: "#9b87f5" },
  celebracion: { label: "Celebración", color: "#e8705f" },
  deporte: { label: "Deporte", color: "#6ea8fe" },
  comida: { label: "Comida", color: "#e39b5f" },
  cultura: { label: "Cultura", color: "#5fc4b5" },
  viaje: { label: "Viaje", color: "#7fc97f" },
  otro: { label: "Otro", color: "#9aa59c" },
};

export const OUTING_STATUS = {
  tentative: { label: "Tentativo" },
  confirmed: { label: "Confirmado" },
  attended: { label: "Fui" },
  not_attended: { label: "No fui" },
};

export const categoryInfo = (id) => OUTING_CATEGORIES[id] ?? null;

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const d = (s) => new Date(`${s}T00:00:00`);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** "lunes 26 de octubre". */
export function longDate(dateStr) {
  const x = d(dateStr);
  return `${WEEKDAYS[x.getDay()]} ${x.getDate()} de ${MONTHS_ES[x.getMonth()]}`;
}

/** "Sábado". */
export const weekdayName = (dateStr) => cap(WEEKDAYS[d(dateStr).getDay()]);

/** { month: "OCT", day: 31 } para los cuadraditos de fecha. */
export function dateTile(dateStr) {
  const x = d(dateStr);
  return { month: MONTHS_ES_ABBR[x.getMonth()].toUpperCase(), day: x.getDate() };
}

/** "hoy", "mañana", "en 5 días", "hace 3 días". */
export function relativeDays(dateStr, today) {
  const days = Math.round((d(dateStr) - d(today)) / 86_400_000);
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  if (days === -1) return "ayer";
  return days > 0 ? `en ${days} días` : `hace ${-days} días`;
}

/** "Sáb 10 oct". */
export function shortDay(dateStr) {
  const x = d(dateStr);
  return `${cap(WEEKDAYS[x.getDay()]).slice(0, 3)} ${x.getDate()} ${MONTHS_ES_ABBR[x.getMonth()].toLowerCase()}`;
}

/** "2 mar 2026". */
export function dayMonthYear(dateStr) {
  if (!dateStr) return null;
  const x = d(dateStr.slice(0, 10));
  return `${x.getDate()} ${MONTHS_ES_ABBR[x.getMonth()].toLowerCase()} ${x.getFullYear()}`;
}

/** "7 h 40 min" a partir de segundos. */
export function durationText(seconds) {
  const m = Math.round((seconds || 0) / 60);
  const h = Math.floor(m / 60);
  return h ? `${h} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;
}
