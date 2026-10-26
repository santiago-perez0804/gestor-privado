// Temporizador Pomodoro persistente: foco → descanso corto (o largo cada N) → espera.
import { todayDateInputValue } from "../lib/format.js";

const KEY = "frog-pomodoro";
const MIN = 60_000;

export const PHASE_LABEL = {
  idle: "Listo para arrancar",
  focus: "Foco",
  short: "Descanso",
  long: "Descanso largo",
  ready: "¿Otro pomodoro?",
};

function defaults() {
  return {
    phase: "idle",
    endsAt: null,
    remaining: null,
    paused: false,
    completedInSet: 0,
    today: { date: todayDateInputValue(), count: 0 },
    settings: { focus: 25, short: 5, long: 15, every: 4 },
  };
}

export function loadPomodoro() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) return { ...defaults(), ...saved, settings: { ...defaults().settings, ...saved.settings } };
  } catch {
    /* dato corrupto */
  }
  return defaults();
}

export function savePomodoro(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sin storage */
  }
}

export const isRunning = (p) => p.phase === "focus" || p.phase === "short" || p.phase === "long";
export const durationOf = (p, phase = p.phase) => (p.settings[phase] ?? 0) * MIN;

export function remainingMs(p, now = Date.now()) {
  if (!isRunning(p)) return 0;
  return p.paused ? p.remaining : Math.max(0, p.endsAt - now);
}

export function start(p, phase = "focus") {
  p.phase = phase;
  p.endsAt = Date.now() + durationOf(p, phase);
  p.paused = false;
  p.remaining = null;
}

export function pause(p) {
  if (!isRunning(p) || p.paused) return;
  p.remaining = Math.max(0, p.endsAt - Date.now());
  p.paused = true;
}

export function resume(p) {
  if (!p.paused) return;
  p.endsAt = Date.now() + p.remaining;
  p.paused = false;
  p.remaining = null;
}

export function stop(p) {
  p.phase = "idle";
  p.endsAt = null;
  p.paused = false;
  p.remaining = null;
  p.completedInSet = 0;
}

function rollToday(p) {
  const today = todayDateInputValue();
  if (p.today.date !== today) p.today = { date: today, count: 0 };
}

/** Cierra la fase actual y pasa a la siguiente. Devuelve el evento ocurrido. */
export function advance(p) {
  if (p.phase === "focus") {
    rollToday(p);
    p.today.count += 1;
    p.completedInSet += 1;
    const next = p.completedInSet % p.settings.every === 0 ? "long" : "short";
    start(p, next);
    return { type: "focusDone", next };
  }
  if (p.phase === "short" || p.phase === "long") {
    p.phase = "ready";
    p.endsAt = null;
    return { type: "breakDone" };
  }
  return null;
}

export function tick(p, now = Date.now()) {
  if (!isRunning(p) || p.paused || now < p.endsAt) return null;
  return advance(p);
}

export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
