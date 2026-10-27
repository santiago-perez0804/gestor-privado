// Formato es-AR: coma decimal, sin ceros de más. El número real queda en la base; esto es solo para mostrar.

/** 32.5 → "32,5"; 91 → "91"; con `decimals` fijos si se pide. */
export function num(n, { decimals = null, max = 2 } = {}) {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat("es-AR", decimals != null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : { maximumFractionDigits: max }).format(n);
}

/** Con signo: +0,5 / −1,5 (signo menos tipográfico). */
export function signed(n, opts) {
  if (n == null || Number.isNaN(n)) return "–";
  const s = num(Math.abs(n), opts);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

/** Peso en kg para mostrar; en peso corporal, el lastre con signo ("+5"). */
export const kg = (n, { bodyweight = false } = {}) => (bodyweight ? (n ? signed(n) : "PC") : num(n));

/** Texto escrito por el usuario → número ("32,5" o "32.5"). null si no es un número. */
export function parseNum(text) {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  const t = String(text ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!t || !/^-?\d*\.?\d+$/.test(t)) return null;
  return Number(t);
}

/** "32,5 × 8, 8, 7" — series del mismo peso juntas. */
export function setsLine(sets, { bodyweight = false } = {}) {
  if (!sets?.length) return "";
  const groups = [];
  for (const s of sets) {
    const last = groups.at(-1);
    if (last && last.w === (s.weightKg ?? 0)) last.reps.push(s.reps);
    else groups.push({ w: s.weightKg ?? 0, reps: [s.reps] });
  }
  return groups.map((g) => `${kg(g.w, { bodyweight })} × ${g.reps.join(", ")}`).join(" · ");
}
