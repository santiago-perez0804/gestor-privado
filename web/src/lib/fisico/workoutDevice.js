// Lo del entreno en vivo que depende del navegador: guardar en el celular, subir con reintentos,
// ids, alarma del descanso y pantalla siempre encendida. La lógica del entreno está en shared.
import { api } from "../api.js";
import { toSnapshot, isDirty } from "./index.js";

const KEY = "fisico.workout.current";

/** Id único. crypto.randomUUID solo existe en contextos seguros (HTTPS/localhost); por la red de casa (HTTP) se arma a mano. */
export function newId() {
  if (globalThis.crypto?.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // contexto no seguro
    }
  }
  const b = new Uint8Array(16);
  (globalThis.crypto?.getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.floor(Math.random() * 256))));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

/** El entreno guardado en el celular (sobrevive a cerrar la pestaña o recargar). */
export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s?.v === 1 && s.session?.id ? s : null;
  } catch {
    return null;
  }
}
export function saveLocal(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // sin espacio o modo privado: igual se intenta subir
  }
}
export function clearLocal() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada
  }
}

/** ¿Hay un entreno en curso guardado en este celular? (para el aviso "Volver al entreno"). */
export function localInProgress() {
  const s = loadLocal();
  return s && s.session.status === "in_progress" ? { id: s.session.id, title: s.session.title, startedAt: s.session.startedAt } : null;
}

/** Sube el estado si hay cambios. Devuelve la versión confirmada (o lanza si no hay conexión). */
export async function push(state) {
  if (!isDirty(state)) return state.syncedAt;
  const version = state.session.updatedAt;
  await api.saveSession(state.session.id, toSnapshot(state));
  return version;
}

// ---------- alarma del descanso ----------
let audio = null;

/** iOS solo deja sonar audio si se habilitó con un toque: se llama al tildar una serie. */
export function unlockAudio() {
  try {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return;
    audio ||= new Ctx();
    if (audio.state === "suspended") audio.resume();
  } catch {
    // sin audio
  }
}

/** Tres pitidos cortos + vibración (si el equipo puede) + notificación si la pestaña no está a la vista. */
export function restDoneAlarm(text = "Terminó el descanso") {
  try {
    if (audio) {
      const t0 = audio.currentTime;
      [0, 0.22, 0.44].forEach((d) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.4, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.16);
        o.connect(g).connect(audio.destination);
        o.start(t0 + d);
        o.stop(t0 + d + 0.18);
      });
    }
  } catch {
    // sin audio
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // iOS no vibra desde la web
  }
  try {
    if (document.visibilityState === "hidden" && "Notification" in globalThis && Notification.permission === "granted") new Notification("Descanso", { body: text, tag: "fisico-rest", silent: false });
  } catch {
    // sin notificaciones
  }
}

/** Pide permiso de notificaciones (solo si el navegador lo soporta y todavía no se preguntó). */
export function askNotifications() {
  try {
    if ("Notification" in globalThis && Notification.permission === "default") Notification.requestPermission();
  } catch {
    // nada
  }
}

// ---------- pantalla encendida ----------
/** Mantiene la pantalla encendida mientras `active` (Wake Lock; Safari 16.4+). Devuelve una función para soltarla. */
export function keepScreenOn() {
  let lock = null;
  let stopped = false;
  const request = async () => {
    try {
      if (!stopped && document.visibilityState === "visible" && navigator.wakeLock) lock = await navigator.wakeLock.request("screen");
    } catch {
      // sin permiso o sin soporte
    }
  };
  const onVisible = () => document.visibilityState === "visible" && request();
  request();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisible);
    lock?.release?.().catch(() => {});
  };
}
