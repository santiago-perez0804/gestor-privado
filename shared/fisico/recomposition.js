// ¿Está funcionando la recomposición? Cuatro señales de las últimas semanas, cada una con un veredicto
// en texto (no solo color): tendencia de peso, cintura, brazo y fuerza (1RM estimado promedio).

/**
 * @param {{ weightChange: number|null, weightPctPerWeek?: number|null, waistChange: number|null,
 *   armChange: number|null, strengthPct: number|null, healthyRatePct?: { min, max } }} s
 * @returns {{ id: string, label: string, value: number|null, unit: string, verdict: string, tone: 'good'|'warn'|'neutral' }[]}
 */
export function recompositionSignals({ weightChange, weightPctPerWeek = null, waistChange, armChange, strengthPct, healthyRatePct = { min: 0.25, max: 0.7 } }) {
  const signals = [];
  const losing = weightChange != null && weightChange <= -0.2;

  let w = { verdict: "Sin datos suficientes", tone: "neutral" };
  if (weightChange != null) {
    const fast = weightPctPerWeek != null && Math.abs(weightPctPerWeek) > healthyRatePct.max;
    if (Math.abs(weightChange) < 0.2) w = { verdict: "Estable", tone: "neutral" };
    else if (weightChange < 0) w = fast ? { verdict: "Bajando rápido: cuidá el músculo", tone: "warn" } : { verdict: "Bajando, sin apuro", tone: "good" };
    else w = { verdict: "Subiendo", tone: "warn" };
  }
  signals.push({ id: "weight", label: "Peso (tendencia)", value: weightChange, unit: "kg", ...w });

  let wa = { verdict: "Falta medir la cintura", tone: "neutral" };
  if (waistChange != null) {
    if (Math.abs(waistChange) < 0.3) wa = { verdict: "Sin cambios", tone: "neutral" };
    else wa = waistChange < 0 ? { verdict: "Se va grasa", tone: "good" } : { verdict: "Sube: revisá la comida", tone: "warn" };
  }
  signals.push({ id: "waist", label: "Cintura", value: waistChange, unit: "cm", ...wa });

  let ar = { verdict: "Falta medir el brazo", tone: "neutral" };
  if (armChange != null) {
    if (Math.abs(armChange) < 0.3) ar = { verdict: losing ? "Se mantiene en déficit" : "Estable", tone: losing ? "good" : "neutral" };
    else ar = armChange > 0 ? { verdict: losing ? "Crece, aun en déficit" : "Crece", tone: "good" } : { verdict: "Baja: sumá volumen o proteína", tone: "warn" };
  }
  signals.push({ id: "arm", label: "Brazo", value: armChange, unit: "cm", ...ar });

  let st = { verdict: "Faltan entrenos registrados", tone: "neutral" };
  if (strengthPct != null) {
    if (strengthPct >= 1) st = { verdict: "Mantenés músculo (y más fuerte)", tone: "good" };
    else if (strengthPct >= -2) st = { verdict: "Mantenés músculo", tone: "good" };
    else st = { verdict: "Perdés fuerza: ojo con el déficit", tone: "warn" };
  }
  signals.push({ id: "strength", label: "Fuerza", value: strengthPct, unit: "% 1RM est.", ...st });
  return signals;
}

/**
 * Cambio de fuerza promedio en una ventana: para cada ejercicio con al menos dos sesiones en la
 * ventana, el % entre la primera y la última; se promedian los `top` ejercicios con más sesiones.
 * @param {{ exerciseId: number, sessions: { date: string, total: number|null }[] }[]} perExercise
 */
export function strengthChange(perExercise, { from, to, top = 5 } = {}) {
  const rows = perExercise
    .map((e) => ({ ...e, sessions: e.sessions.filter((s) => s.total != null && (!from || s.date >= from) && (!to || s.date <= to)) }))
    .filter((e) => e.sessions.length >= 2)
    .sort((a, b) => b.sessions.length - a.sessions.length)
    .slice(0, top)
    .map((e) => ((e.sessions.at(-1).total - e.sessions[0].total) / e.sessions[0].total) * 100);
  return rows.length ? Math.round((rows.reduce((s, x) => s + x, 0) / rows.length) * 10) / 10 : null;
}
