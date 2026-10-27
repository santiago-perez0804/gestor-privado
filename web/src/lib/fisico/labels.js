// Textos de Físico para la interfaz (es-AR). Los cálculos están en shared/fisico; acá solo se muestran.
import { MUSCLES, EQUIPMENT, num, kg, setsLine } from "./index.js";

export const muscleLabel = (id) => MUSCLES[id] ?? id;
export const equipmentLabel = (id) => EQUIPMENT[id] ?? id;
export const WEEKDAY_LABELS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const WEEKDAY_SHORT = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** 150 → "2:30"; 60 → "1:00". */
export const restText = (seconds) => `${Math.floor((seconds || 0) / 60)}:${String((seconds || 0) % 60).padStart(2, "0")}`;

/** "3 × 5–7" (o "3 × 8" si el rango es un solo número). */
export const prescriptionText = (it) => `${it.sets} × ${it.repMin === it.repMax ? it.repMin : `${it.repMin}–${it.repMax}`}`;

/** "RIR 1–2", "RIR 1", o "" si no tiene. */
export function rirText(min, max) {
  if (min == null && max == null) return "";
  if (min == null || max == null || min === max) return `RIR ${num(min ?? max)}`;
  return `RIR ${num(min)}–${num(max)}`;
}

/** Músculos de un ejercicio: "Espalda · Bíceps" (primarios primero). */
export const musclesText = (muscles = []) =>
  [...muscles]
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "primary" ? -1 : 1))
    .map((m) => muscleLabel(m.muscle))
    .join(" · ");

/**
 * Iniciales de una rutina para el cuadradito, distintas entre rutinas parecidas:
 * "Push A" → "PSA", "Pull A" → "PLA", "Legs" → "LG", "Full body" → "FB".
 */
export function routineInitials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const stem = (w) => (w[0] + (w.slice(1).match(/[^aeiouáéíóú\s]/i)?.[0] ?? w[1] ?? "")).toUpperCase();
  const [first, second] = words;
  if (second && second.length <= 2) return stem(first) + second.toUpperCase(); // "Push A", "Día 1"
  if (second) return (first[0] + second[0]).toUpperCase();
  return stem(first);
}

/** Lo de la última vez: "32,5 × 8, 8, 7" (en peso corporal, el lastre: "+5 × 6, 6, 5"). */
export const lastText = (last, exercise) => (last?.sets?.length ? setsLine(last.sets, { bodyweight: exercise?.isBodyweight }) : "—");

/**
 * La sugerencia para la próxima vez, corta: "62,5 kg" (subir), "mismo, +1 rep", "bajá a 37,5 kg".
 * @returns {{ text: string, tone: 'up'|'same'|'down'|'none' }}
 */
export function nextText(next, exercise) {
  if (!next || next.kind === "start") return { text: "elegí el peso", tone: "none" };
  const bw = !!exercise?.isBodyweight;
  if (next.kind === "increase") return { text: bw ? `${kg(next.weightKg, { bodyweight: true })} kg` : `${num(next.weightKg)} kg`, tone: "up" };
  if (next.kind === "decrease") return { text: `bajá a ${bw ? kg(next.weightKg, { bodyweight: true }) : num(next.weightKg)} kg`, tone: "down" };
  const extra = next.targetReps.reduce((s, r, i) => s + Math.max(0, r - (next.previous?.reps?.[i] ?? r)), 0);
  return { text: extra > 0 ? `mismo, +${extra} ${extra === 1 ? "rep" : "reps"}` : "mismo, +reps", tone: "same" };
}
