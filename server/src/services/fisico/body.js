// Peso corporal desde la base: pesadas por día y tendencia (los cálculos, en shared/fisico/weight).
import { dayOf } from "../../../../shared/fisico/dates.js";
import { trendSeries, trendAt } from "../../../../shared/fisico/weight.js";
import { getSettings, today } from "./common.js";

export function createBody(db) {
  /** Pesadas como { id, day, kg, recordedAt, note } (el día en la zona del usuario). */
  function weighIns() {
    const tz = getSettings(db).timeZone;
    return db
      .prepare("SELECT id, weight, recordedAt, note FROM weights ORDER BY recordedAt")
      .all()
      .map((w) => ({ id: w.id, day: dayOf(w.recordedAt, tz), kg: w.weight, recordedAt: w.recordedAt, note: w.note }));
  }

  /** Tendencia de peso de un día (por defecto hoy); null si no hay pesadas. */
  function trendOn(day = today(db)) {
    const series = trendSeries(weighIns(), { until: day });
    const v = trendAt(series, day);
    return v == null ? null : Math.round(v * 10) / 10;
  }

  return { weighIns, trendOn };
}
