// Hábitos diarios: tildar por día, editar la lista, últimos 7 días y racha de cada uno.
import { addDays } from "../../../../shared/fisico/dates.js";
import { habitsSummary } from "../../../../shared/fisico/habits.js";
import { bad, notFound, nowIso, today } from "./common.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function createHabits(db) {
  const active = () => db.prepare("SELECT * FROM habits WHERE archived = 0 ORDER BY sortOrder, id").all();

  /** Hábitos con lo tildado (últimos 90 días) y el resumen: racha, 7 días, el que más se cae. */
  function list() {
    const t = today(db);
    const from = addDays(t, -90);
    const logs = db.prepare("SELECT habitId, localDate FROM habit_logs WHERE done = 1 AND localDate >= ?").all(from);
    const habits = active().map((h) => ({ id: h.id, name: h.name, targetLabel: h.targetLabel, doneDays: logs.filter((l) => l.habitId === h.id).map((l) => l.localDate) }));
    const summary = habitsSummary(habits, t);
    return {
      today: t,
      habits: habits.map((h) => {
        const row = summary.rows.find((r) => r.id === h.id);
        return { id: h.id, name: h.name, targetLabel: h.targetLabel, doneToday: row.today, streak: row.streak, week: row.week };
      }),
      doneToday: summary.doneToday,
      best: summary.best && { id: summary.best.id, name: summary.best.name, streak: summary.best.streak },
      worst: summary.worst && { id: summary.worst.id, name: summary.worst.name, doneLast7: summary.worst.doneLast7 },
    };
  }

  /** Tildar o destildar un hábito en un día (por defecto hoy). */
  function toggle(habitId, { day, done }) {
    if (!db.prepare("SELECT 1 FROM habits WHERE id = ?").get(Number(habitId))) throw notFound();
    const d = day || today(db);
    if (!DATE.test(d) || d > today(db)) throw bad("invalid_day");
    if (done) db.prepare("INSERT INTO habit_logs (habitId, localDate, done) VALUES (?, ?, 1) ON CONFLICT(habitId, localDate) DO UPDATE SET done = 1").run(Number(habitId), d);
    else db.prepare("DELETE FROM habit_logs WHERE habitId = ? AND localDate = ?").run(Number(habitId), d);
    return list();
  }

  function create({ name, targetLabel }) {
    if (!String(name || "").trim()) throw bad("name_required");
    const order = db.prepare("SELECT COALESCE(MAX(sortOrder), -1) + 1 AS n FROM habits").get().n;
    db.prepare("INSERT INTO habits (name, targetLabel, sortOrder, archived, createdAt) VALUES (?, ?, ?, 0, ?)").run(name.trim(), targetLabel || null, order, nowIso());
    return list();
  }

  function update(id, { name, targetLabel, archived }) {
    const h = db.prepare("SELECT * FROM habits WHERE id = ?").get(Number(id));
    if (!h) throw notFound();
    const n = name !== undefined ? String(name).trim() : h.name;
    if (!n) throw bad("name_required");
    db.prepare("UPDATE habits SET name = ?, targetLabel = ?, archived = ? WHERE id = ?").run(n, targetLabel !== undefined ? targetLabel || null : h.targetLabel, archived !== undefined ? (archived ? 1 : 0) : h.archived, h.id);
    return list();
  }

  return { list, toggle, create, update };
}
