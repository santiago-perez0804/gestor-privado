// Hábitos diarios: últimos días, racha y cuál se te cae más.
import { addDays } from "./dates.js";

/** Los últimos `n` días (del más viejo a hoy) con si se cumplió. */
export function lastDays(doneDays, today, n = 7) {
  const set = doneDays instanceof Set ? doneDays : new Set(doneDays);
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    return { day, done: set.has(day) };
  });
}

/** Racha actual: días seguidos cumplidos hasta hoy (o hasta ayer si hoy todavía no). */
export function habitStreak(doneDays, today) {
  const set = doneDays instanceof Set ? doneDays : new Set(doneDays);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/**
 * Resumen para Inicio: el de mejor racha y el que más se cae en la última semana.
 * @param {{ id, name, doneDays: string[] }[]} habits
 */
export function habitsSummary(habits, today) {
  const rows = habits.map((h) => {
    const week = lastDays(h.doneDays, today, 7);
    return { id: h.id, name: h.name, streak: habitStreak(h.doneDays, today), doneLast7: week.filter((d) => d.done).length, week, today: week.at(-1).done };
  });
  const best = [...rows].sort((a, b) => b.streak - a.streak)[0] ?? null;
  const worst = [...rows].sort((a, b) => a.doneLast7 - b.doneLast7)[0] ?? null;
  return { rows, best: best?.streak > 0 ? best : null, worst: worst && worst.doneLast7 < 7 ? worst : null, doneToday: rows.filter((r) => r.today).length };
}
