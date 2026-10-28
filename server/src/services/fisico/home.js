// Inicio de Físico: todo de una vez (semana con estados y racha, el próximo entreno con qué intentar,
// peso, volumen por músculo de la semana, hábitos, señales de recomposición, récords recientes y
// cuándo tocan la próxima foto y medición). Lee de los demás servicios; los cálculos, en shared.
import { addDays, weekDays, daysBetween } from "../../../../shared/fisico/dates.js";
import { weekPlan, weekStreak } from "../../../../shared/fisico/schedule.js";
import { doneVolume, plannedVolume, weeklyVolume, shortMuscles } from "../../../../shared/fisico/volume.js";
import { byZone, changeBetween } from "../../../../shared/fisico/measurements.js";
import { recompositionSignals, strengthChange } from "../../../../shared/fisico/recomposition.js";
import { getSettings, today } from "./common.js";
import { toExercise } from "./exercises.js";

export function createHome(db, { plans, workouts, body, records, measurements, photos, habits, history }) {
  const exercisesById = async () => new Map((await db.prepare("SELECT * FROM exercises").all()).map((r) => [r.id, toExercise(r)]));

  /** Racha de semanas cumplidas (con la agenda actual, desde que hay entrenos o empezó el plan). */
  async function streak(planId, schedule, t, threshold) {
    const first = (await db.prepare("SELECT MIN(localDate) AS d FROM workout_sessions WHERE status = 'done'").get()).d;
    const start = (await plans.detail(planId)).startDate;
    const since = [first, start].filter(Boolean).sort()[0];
    if (!since) return { weeks: 0, current: null };
    const weeks = [];
    for (let i = 1; i <= 52; i++) {
      const days = weekDays(addDays(t, -7 * i));
      if (days[6] < since) break;
      const sessions = await db.prepare("SELECT localDate, routineId FROM workout_sessions WHERE status = 'done' AND localDate BETWEEN ? AND ?").all(days[0], days[6]);
      const p = weekPlan({ days, schedule, sessions, today: addDays(days[6], 1) });
      weeks.push({ planned: p.planned, done: p.done });
    }
    return { weeks, threshold };
  }

  async function home() {
    const settings = await getSettings(db);
    const t = await today(db);
    const planId = await plans.activeId();
    const plan = planId ? await plans.detail(planId) : null;
    const ex = await exercisesById();
    const week = await workouts.week(t);
    const days = weekDays(t);
    const scheduleMap = plan ? Object.fromEntries(plan.schedule.map((d) => [d.weekday, d])) : {};

    // Semana y racha.
    let streakWeeks = 0;
    if (plan && week) {
      const s = await streak(plan.id, scheduleMap, t, settings.weekDoneThreshold);
      streakWeeks = s.weeks ? weekStreak(s.weeks, { planned: week.planned, done: week.done }, settings.weekDoneThreshold) : 0;
    }
    const routineName = new Map((plan?.routines ?? []).map((r) => [r.id, r.name]));

    // Próximo entreno con "qué intentar": los ejercicios de los músculos prioritarios primero, y los que suben.
    let next = null;
    if (plan && week?.next) {
      const r = plan.routines.find((x) => x.id === week.next.routineId);
      if (r) {
        const prio = plan.priorityMuscles;
        const score = (it) => (it.exercise?.muscles?.some((m) => m.role === "primary" && prio.includes(m.muscle)) ? 2 : 0) + (it.next?.kind === "increase" ? 1 : 0);
        next = {
          date: week.next.date,
          status: week.next.status,
          movedFrom: week.next.movedFrom,
          routineId: r.id,
          name: r.name,
          exerciseCount: r.exerciseCount,
          setCount: r.setCount,
          estimatedMinutes: r.estimatedMinutes,
          extras: week.days.find((d) => d.date === week.next.date)?.extras ?? [],
          muscles: Object.entries(r.volume).sort((a, b) => Number(prio.includes(b[0])) - Number(prio.includes(a[0])) || b[1] - a[1]).slice(0, 4).map(([m]) => ({ muscle: m, priority: prio.includes(m) })),
          tryList: [...r.items]
            .filter((it) => it.last)
            .sort((a, b) => score(b) - score(a))
            .slice(0, 4)
            .map((it) => ({ name: it.exercise?.name, isBodyweight: !!it.exercise?.isBodyweight, last: it.last, next: it.next })),
        };
      }
    }

    // Volumen de esta semana: planificado (agenda) y hecho (series de trabajo completadas).
    let volume = null;
    if (plan) {
      const items = new Map(plan.routines.map((r) => [r.id, r.items]));
      const planned = plannedVolume(plan.schedule.map((d) => d.routineId), items, ex);
      const sets = await db
        .prepare("SELECT l.exerciseId, l.type, l.completedAt FROM set_logs l JOIN workout_sessions s ON s.id = l.sessionId WHERE s.status = 'done' AND s.localDate BETWEEN ? AND ?")
        .all(days[0], days[6]);
      const rows = weeklyVolume({ planned, done: doneVolume(sets, ex), range: settings.volumeRange, priorityMuscles: plan.priorityMuscles });
      volume = { rows: rows.filter((r) => r.planned > 0 || r.done > 0), short: shortMuscles(rows, { min: settings.volumeRange.min }), range: settings.volumeRange };
    }

    // Recomposición: últimas 4 semanas.
    const weight = await body.summary();
    const zones = byZone(await db.prepare("SELECT measuredOn, zone, valueCm FROM measurements").all());
    const from = addDays(t, -28);
    const perExercise = (await Promise.all((await db
      .prepare("SELECT DISTINCT l.exerciseId FROM set_logs l JOIN workout_sessions s ON s.id = l.sessionId WHERE s.status = 'done' AND s.localDate >= ?")
      .all(addDays(t, -35)))
      .map(async ({ exerciseId }) => ({ exerciseId, sessions: (await history.progress(exerciseId, { isBodyweight: ex.get(exerciseId)?.isBodyweight })).map((h) => ({ date: h.date, total: h.total })) }))));
    const signals = recompositionSignals({
      weightChange: weight.rate?.change ?? null,
      weightPctPerWeek: weight.rate?.pctPerWeek ?? null,
      waistChange: changeBetween(zones.cintura, from, t),
      armChange: changeBetween(zones.brazo, from, t),
      strengthPct: strengthChange(perExercise, { from: addDays(t, -35), to: t }),
      healthyRatePct: settings.healthyRatePct,
    });

    const m = await measurements.summary();
    const ph = await photos.list();
    return {
      today: t,
      plan: plan && { id: plan.id, name: plan.name, currentWeek: plan.currentWeek, weeks: plan.weeks, isDeloadWeek: plan.isDeloadWeek },
      week: week && {
        planned: week.planned,
        done: week.done,
        streak: streakWeeks,
        days: week.days.map((d) => ({ ...d, routineName: d.routineId ? routineName.get(d.routineId) ?? null : null, doneNames: d.doneRoutineIds.map((id) => routineName.get(id) ?? "Entreno libre") })),
      },
      next,
      weight: {
        current: weight.current,
        last: weight.last,
        rate: weight.rate,
        goal: weight.goal,
        projection: weight.projection,
        neededStatus: weight.neededStatus,
        chart: { weighIns: weight.chart.weighIns.filter((p) => p.x >= weight.chart.todayX - 42), trend: weight.chart.trend.filter((p) => p.x >= weight.chart.todayX - 42), firstDay: weight.chart.firstDay, todayX: weight.chart.todayX },
        typoJumpKg: weight.typoJumpKg,
      },
      volume,
      habits: await habits.list(),
      signals,
      records: await records.recent({ days: 21, limit: 3 }),
      nextPhoto: ph.next,
      nextMeasurement: m.next,
      daysSinceLastWorkout: await (async () => {
        const last = (await db.prepare("SELECT MAX(localDate) AS d FROM workout_sessions WHERE status = 'done'").get()).d;
        return last ? daysBetween(last, t) : null;
      })(),
    };
  }

  return { home };
}
