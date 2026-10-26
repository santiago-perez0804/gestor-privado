// Estadísticas de Ocio: funciones puras (sin base de datos), fáciles de testear.
// "Terminado" = una pasada terminada; una relectura cuenta como otra cosa terminada.

/** @typedef {{ type: string, date: string, title?: string, rating?: number|null, genres?: string[], entryId?: number }} Finished */

const TYPES = ["movie", "series", "book", "game"];
const DAY_MS = 86_400_000;
const pad = (n) => String(n).padStart(2, "0");
const toDate = (s) => new Date(`${s}T00:00:00`);
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const emptyByType = () => Object.fromEntries(TYPES.map((t) => [t, 0]));

/** Cuántos de cada tipo. */
export function countByType(finished) {
  const out = emptyByType();
  for (const f of finished) if (f.type in out) out[f.type] += 1;
  return out;
}

/** Los 12 meses del año con lo terminado en cada uno (para el gráfico de bloques). */
export function finishedByMonth(finished, year) {
  const months = Array.from({ length: 12 }, (_, month) => ({ month, total: 0, byType: emptyByType(), items: [] }));
  for (const f of finished) {
    if (!f.date || Number(f.date.slice(0, 4)) !== year) continue;
    const m = months[Number(f.date.slice(5, 7)) - 1];
    m.total += 1;
    if (f.type in m.byType) m.byType[f.type] += 1;
    m.items.push({ type: f.type, title: f.title, entryId: f.entryId });
  }
  return months;
}

/** Géneros más frecuentes: [{ id, count }] de mayor a menor (desempata alfabético). */
export function topGenres(rows, limit = 5) {
  const counts = new Map();
  for (const r of rows) for (const g of new Set(r.genres || [])) counts.set(g, (counts.get(g) || 0) + 1);
  return [...counts]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Promedio de las puntuaciones cargadas (null si no hay ninguna), con un decimal. */
export function averageRating(rows) {
  const rated = rows.map((r) => r.rating).filter((r) => typeof r === "number");
  if (!rated.length) return null;
  return Math.round((rated.reduce((s, r) => s + r, 0) / rated.length) * 10) / 10;
}

/** Día del año (1..365/366) y largo del año de `today`. */
export function yearProgress(today) {
  const d = toDate(today);
  const start = new Date(d.getFullYear(), 0, 1);
  const end = new Date(d.getFullYear() + 1, 0, 1);
  return { day: Math.round((d - start) / DAY_MS) + 1, length: Math.round((end - start) / DAY_MS) };
}

/** Promedio por mes en lo que va del año (o en el año entero si ya pasó). */
export function perMonth(count, year, today) {
  const t = toDate(today);
  const months = t.getFullYear() > year ? 12 : t.getFullYear() < year ? 0 : t.getMonth() + t.getDate() / new Date(year, t.getMonth() + 1, 0).getDate();
  return months > 0 ? Math.round((count / months) * 10) / 10 : 0;
}

/**
 * Meta anual con proyección: dónde "tendrías que estar" hoy, cuántos terminás a este ritmo,
 * cada cuántos días tendrías que terminar uno para llegar y una meta más realista si no llegás.
 */
export function goalProjection({ done, target, today }) {
  const { day, length } = yearProgress(today);
  const expectedNow = Math.round((target * day) / length);
  const projected = Math.round((done / day) * length);
  const missing = Math.max(0, target - done);
  const daysLeft = length - day;
  return {
    done,
    target,
    ratio: Math.min(1, done / target),
    expectedNow,
    onTrack: done >= expectedNow,
    projected,
    everyDays: missing > 0 ? Math.max(1, Math.floor(daysLeft / missing)) : null,
    realistic: projected < target ? Math.max(done + 1, projected) : null,
  };
}

/** Viernes a domingo del fin de semana que viene (o el actual si ya empezó). */
export function weekendRange(today) {
  const d = toDate(today);
  const dow = d.getDay(); // 0 domingo … 6 sábado
  const toFriday = dow === 0 ? -2 : 5 - dow; // domingo: el finde ya empezó el viernes
  const friday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + toFriday);
  const sunday = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() + 2);
  return { from: dateStr(friday > d ? friday : d), to: dateStr(sunday) };
}

/** Días entre dos fechas YYYY-MM-DD (b − a). */
export function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / DAY_MS);
}

// ---------------------------------------------------------------------------------------------
// Lectura (sesiones de KOReader o cargadas a mano). Fechas y horas en la zona local del equipo.

/** @typedef {{ startTime: string, durationSeconds: number, pagesRead: number, workId?: number }} Session */

const localDay = (iso) => dateStr(new Date(iso));

/** Franjas del día para "¿Cuándo leés?". */
export const HOUR_BUCKETS = [
  { id: "morning", label: "Mañana", from: 6, to: 12 },
  { id: "afternoon", label: "Tarde", from: 12, to: 18 },
  { id: "night", label: "Noche", from: 18, to: 24 },
  { id: "late", label: "Madrugada", from: 0, to: 6 },
];

/** Racha actual (hasta hoy, o hasta ayer si hoy todavía no leíste) y la mejor del período. */
export function streaks(days, today) {
  const set = new Set(days);
  const sorted = [...set].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let current = 0;
  let cursor = set.has(today) ? today : dateStr(new Date(toDate(today).getTime() - DAY_MS));
  while (set.has(cursor)) {
    current += 1;
    cursor = dateStr(new Date(toDate(cursor).getTime() - DAY_MS));
  }
  return { current, best };
}

/** Niveles 0–4 para el calendario tipo GitHub: 0 = no leíste; 1–4 según cuartiles de los días leídos. */
export function intensityLevels(values) {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!nonZero.length) return values.map(() => 0);
  const q = (p) => nonZero[Math.floor(p * (nonZero.length - 1))];
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  return values.map((v) => (v <= 0 ? 0 : v <= q1 ? 1 : v <= q2 ? 2 : v <= q3 ? 3 : 4));
}

/**
 * Estadísticas de lectura de un año: páginas, tiempo, ritmo, días con lectura, rachas, franja
 * horaria, día récord, páginas por mes y el calendario (un valor por día con su nivel).
 * @param {Session[]} sessions
 */
export function readingStats(sessions, { year, today }) {
  const ofYear = sessions.filter((s) => new Date(s.startTime).getFullYear() === year);
  const pages = ofYear.reduce((s, x) => s + x.pagesRead, 0);
  const seconds = ofYear.reduce((s, x) => s + x.durationSeconds, 0);
  const byDay = new Map();
  const byDayWork = new Map();
  for (const s of ofYear) {
    const d = localDay(s.startTime);
    byDay.set(d, (byDay.get(d) || 0) + s.pagesRead);
    const k = `${d}|${s.workId ?? ""}`;
    byDayWork.set(k, (byDayWork.get(k) || 0) + s.pagesRead);
  }
  const pagesByMonth = Array(12).fill(0);
  for (const [d, p] of byDay) pagesByMonth[Number(d.slice(5, 7)) - 1] += p;
  const buckets = Object.fromEntries(HOUR_BUCKETS.map((b) => [b.id, 0]));
  for (const s of ofYear) {
    const h = new Date(s.startTime).getHours();
    buckets[HOUR_BUCKETS.find((b) => h >= b.from && h < b.to).id] += 1;
  }
  const [recordKey, recordPages] = [...byDayWork].sort((a, b) => b[1] - a[1])[0] || [];
  // Calendario: todos los días del año (hasta hoy si es el año en curso).
  const isCurrent = Number(today.slice(0, 4)) === year;
  const last = isCurrent ? toDate(today) : new Date(year, 11, 31);
  const calendar = [];
  for (let d = new Date(year, 0, 1); d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const key = dateStr(d);
    calendar.push({ date: key, pages: byDay.get(key) || 0 });
  }
  const levels = intensityLevels(calendar.map((c) => c.pages));
  calendar.forEach((c, i) => (c.level = levels[i]));
  const { current, best } = streaks([...byDay.keys()], today);
  return {
    pages,
    seconds,
    pagesPerHour: seconds ? Math.round(pages / (seconds / 3600)) : null,
    secondsPerPage: pages ? Math.round(seconds / pages) : null,
    daysWithReading: byDay.size,
    daysInPeriod: calendar.length,
    currentStreak: current,
    bestStreak: best,
    sessions: ofYear.length,
    hourBuckets: HOUR_BUCKETS.map((b) => ({ ...b, sessions: buckets[b.id], share: ofYear.length ? buckets[b.id] / ofYear.length : 0 })),
    recordDay: recordKey ? { date: recordKey.split("|")[0], pages: recordPages, workId: Number(recordKey.split("|")[1]) || null } : null,
    pagesByMonth,
    calendar,
  };
}

/**
 * Récords de libros terminados en el año: el más largo (páginas), el más rápido y el que más
 * costó (más días de empezar a terminar), y cuántos días lleva en promedio un libro.
 * @param {{ entryId, title, startedAt, date, rating, metadata }[]} books (pasadas terminadas)
 */
export function bookRecords(books) {
  const withDays = books.filter((b) => b.startedAt && b.date).map((b) => ({ ...b, days: daysBetween(b.startedAt, b.date) + 1 }));
  const withPages = books.filter((b) => b.metadata?.pages);
  const by = (list, fn) => (list.length ? list.reduce((a, b) => (fn(b) > fn(a) ? b : a)) : null);
  return {
    longest: by(withPages, (b) => b.metadata.pages),
    fastest: by(withDays, (b) => -b.days),
    slowest: by(withDays, (b) => b.days),
    averageDays: withDays.length ? Math.round(withDays.reduce((s, b) => s + b.days, 0) / withDays.length) : null,
  };
}
