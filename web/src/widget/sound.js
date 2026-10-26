// Sonidos sintetizados con WebAudio (sin archivos). Se pueden silenciar desde la tarjeta.
const MUTE_KEY = "frog-muted";
let ctx = null;

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* sin storage: el cambio dura solo esta sesión */
  }
}

function audio({ force = false } = {}) {
  if (!force && isMuted()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(ac, { start, duration, from, to, type = "sawtooth", volume = 0.06, cutoff = 900 }) {
  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(filter).connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export function croak() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  blip(ac, { start: t, duration: 0.16, from: 150, to: 95 });
  blip(ac, { start: t + 0.2, duration: 0.2, from: 140, to: 80 });
}

export function gulp() {
  const ac = audio();
  if (!ac) return;
  blip(ac, { start: ac.currentTime, duration: 0.12, from: 500, to: 180, type: "sine", volume: 0.08, cutoff: 2000 });
}

export function thwip() {
  const ac = audio();
  if (!ac) return;
  blip(ac, { start: ac.currentTime, duration: 0.09, from: 300, to: 1400, type: "sine", volume: 0.05, cutoff: 4000 });
}

export function boing() {
  const ac = audio();
  if (!ac) return;
  blip(ac, { start: ac.currentTime, duration: 0.25, from: 220, to: 520, type: "triangle", volume: 0.05, cutoff: 3000 });
}

export function chirp() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  blip(ac, { start: t, duration: 0.08, from: 700, to: 1000, type: "triangle", volume: 0.04, cutoff: 4000 });
  blip(ac, { start: t + 0.1, duration: 0.1, from: 800, to: 1200, type: "triangle", volume: 0.04, cutoff: 4000 });
}

export function pop() {
  const ac = audio();
  if (!ac) return;
  blip(ac, { start: ac.currentTime, duration: 0.1, from: 600, to: 950, type: "sine", volume: 0.06, cutoff: 4000 });
}

/** Campanita del Pomodoro: suena aunque el sapo esté silenciado (es un aviso pedido). */
export function chime() {
  const ac = audio({ force: true });
  if (!ac) return;
  const t = ac.currentTime;
  for (const [i, f] of [880, 1175, 1568].entries()) {
    blip(ac, { start: t + i * 0.16, duration: 0.6, from: f, to: f * 0.995, type: "sine", volume: 0.07, cutoff: 6000 });
  }
}
