// Peso corporal desde la base: pesadas por día y tendencia (los cálculos, en shared/fisico/weight).
import { addDays, dayOf, daysBetween } from "../../../../shared/fisico/dates.js";
import { trendSeries, trendAt, weeklyRate, projection, rateStatus, weeklyAverages } from "../../../../shared/fisico/weight.js";
import { bad, getSettings, nowIso, today } from "./common.js";

const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

export function createBody(db) {
  /** Pesadas como { id, day, kg, recordedAt, note } (el día en la zona del usuario). */
  async function weighIns() {
    const tz = (await getSettings(db)).timeZone;
    return (await db
      .prepare("SELECT id, weight, recordedAt, note FROM weights ORDER BY recordedAt")
      .all())
      .map((w) => ({ id: w.id, day: dayOf(w.recordedAt, tz), kg: w.weight, recordedAt: w.recordedAt, note: w.note }));
  }

  /** Tendencia de peso de un día (por defecto hoy); null si no hay pesadas. */
  async function trendOn(day) {
    day ??= await today(db);
    const series = trendSeries(await weighIns(), { until: day });
    const v = trendAt(series, day);
    return v == null ? null : Math.round(v * 10) / 10;
  }

  /** La meta de peso vigente (la última cargada). */
  const goal = async () => await db.prepare("SELECT * FROM goals WHERE type = 'weight' ORDER BY id DESC LIMIT 1").get() ?? null;

  /** Poner o cambiar la meta (kg y fecha opcional). También actualiza el ajuste viejo que usa el widget. */
  async function setGoal({ target, targetDate = null }) {
    const t = Number(target);
    if (!(t > 20 && t < 400)) throw bad("invalid_target");
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw bad("invalid_targetDate");
    const ts = nowIso();
    const g = await goal();
    if (g) await db.prepare("UPDATE goals SET target = ?, targetDate = ?, achievedAt = NULL, updatedAt = ? WHERE id = ?").run(t, targetDate || null, ts, g.id);
    else await db.prepare("INSERT INTO goals (type, target, targetDate, createdAt, updatedAt) VALUES ('weight', ?, ?, ?, ?)").run(t, targetDate || null, ts, ts);
    await db.prepare("INSERT INTO settings (key, value) VALUES ('weight_goal_kg', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(t));
    return await goal();
  }

  /**
   * Todo lo de la pantalla Peso: tendencia, ritmo de 4 semanas, meta con proyección, semáforo,
   * promedios semanales y los puntos del gráfico (pesadas, tendencia y proyecciones).
   */
  async function summary() {
    const settings = await getSettings(db);
    const t = await today(db);
    const list = await weighIns();
    const series = trendSeries(list, { until: t });
    const current = trendAt(series, t);
    const rate = weeklyRate(series, t);
    const g = await goal();
    const startKg = g ? trendAt(series, dayOf(g.createdAt, settings.timeZone)) ?? series[0]?.trend ?? null : null;
    const proj = g && current != null ? projection({ current, kgPerWeek: rate?.kgPerWeek ?? null, target: g.target, targetDate: g.targetDate, today: t, startKg }) : null;
    const healthy = settings.healthyRatePct;
    // Si la meta pide más rápido de lo saludable: qué fecha sería razonable al máximo saludable.
    let healthyDate = null;
    if (proj && !proj.reached && proj.neededPct != null && proj.neededPct > healthy.max && current) {
      const kgPerWeekMax = (current * healthy.max) / 100;
      healthyDate = addDays(t, Math.ceil((Math.abs(g.target - current) / kgPerWeekMax) * 7));
    }
    const first = series[0]?.day ?? t;
    const x = (day) => daysBetween(first, day);
    const end = g?.targetDate && g.targetDate > t ? g.targetDate : addDays(t, 56);
    const lines = [];
    if (current != null && rate) lines.push({ id: "current", points: [{ x: x(t), y: r2(current) }, { x: x(end), y: r2(current + (rate.kgPerWeek * daysBetween(t, end)) / 7) }] });
    if (proj?.neededKgPerWeek != null && g.targetDate > t) lines.push({ id: "goal", points: [{ x: x(t), y: r2(current) }, { x: x(g.targetDate), y: g.target }] });
    return {
      today: t,
      weighIns: list.slice().reverse(),
      current: r2(current),
      last: list.at(-1) ?? null,
      rate,
      rateStatus: rateStatus(rate?.pctPerWeek ?? null, healthy),
      healthyRatePct: healthy,
      goal: g && { id: g.id, target: g.target, targetDate: g.targetDate, startKg: r2(startKg) },
      projection: proj,
      neededStatus: proj?.neededPct != null ? rateStatus(proj.neededPct, healthy) : null,
      healthyDate,
      weeks: weeklyAverages(list).slice(0, 12),
      chart: {
        weighIns: list.map((w) => ({ x: x(w.day), y: w.kg })),
        trend: series.map((p) => ({ x: x(p.day), y: r2(p.trend) })),
        lines,
        todayX: x(t),
        firstDay: first,
        endDay: end,
      },
      typoJumpKg: settings.typoJumpKg,
    };
  }

  return { weighIns, trendOn, goal, setGoal, summary };
}
