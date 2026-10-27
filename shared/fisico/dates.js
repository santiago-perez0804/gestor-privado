// Fechas de Físico en la zona horaria del usuario (no la del equipo: en la nube el server está en UTC).
// Los días se manejan como texto "YYYY-MM-DD" y la aritmética de días se hace en UTC, así un cambio
// de horario de verano nunca corre un día.

export const TZ = "America/Argentina/Buenos_Aires";
const DAY_MS = 86_400_000;

const partsIn = (instant, tz) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(instant)
      .map((x) => [x.type, x.value])
  );
  return p;
};

/** Día local ("YYYY-MM-DD") de un instante en la zona dada. */
export function localDate(instant = new Date(), tz = TZ) {
  const p = partsIn(new Date(instant), tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Fecha y hora local ("YYYY-MM-DDTHH:mm") de un instante en la zona dada. */
export function localDateTime(instant = new Date(), tz = TZ) {
  const p = partsIn(new Date(instant), tz);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * Día de una marca de tiempo guardada: si es hora local sin zona ("2026-10-26T00:30") es ese día
 * tal cual; si es un instante con zona ("…Z" o "…-03:00") se pasa a la zona del usuario.
 */
export function dayOf(stamp, tz = TZ) {
  const s = String(stamp || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return localDate(new Date(s), tz);
  return s.slice(0, 10);
}

const utc = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (day, n) => fromUtc(utc(day) + n * DAY_MS);
/** Días de `a` a `b` (b − a). */
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY_MS);
/** Día de la semana: 1 = lunes … 7 = domingo. */
export const weekday = (day) => ((new Date(utc(day)).getUTCDay() + 6) % 7) + 1;
/** Lunes de la semana de `day`. */
export const weekStart = (day) => addDays(day, 1 - weekday(day));
/** Los 7 días (lunes a domingo) de la semana de `day`. */
export const weekDays = (day) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i));
/** Lista de días desde `from` hasta `to` inclusive. */
export function dayRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
