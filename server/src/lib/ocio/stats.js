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
