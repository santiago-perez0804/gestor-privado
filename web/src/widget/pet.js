// La mascota: especie, nombre, nivel y necesidades (salud, hambre, sueño, ánimo). Se guarda en
// localStorage y sigue "viviendo" mientras la app está cerrada (con tope de 48 h).
// Si se la descuida demasiado se muere: pasa al historial y se adopta otra desde nivel 1.
// Los datos del gestor (gastos, entrenos…) están en la base y no se tocan nunca.
import { ACCESSORIES } from "./accessories.js";

const KEY = "frog-pet";
const HISTORY_KEY = "frog-pet-history";
const LEGACY_FLIES_KEY = "frog-flies-eaten";
const HOUR = 3600;
const DAY_MS = 86_400_000;
const MAX_CATCH_UP_S = 48 * HOUR;

export const SPECIES = {
  sapo: { label: "Sapo", defaultName: "Sapito", sound: "¡Croac!", soft: "Croac." },
  zorro: { label: "Zorro", defaultName: "Zorrito", sound: "¡Yip!", soft: "Yip." },
};

export const STATS = [
  { key: "health", label: "Salud" },
  { key: "hunger", label: "Hambre" },
  { key: "energy", label: "Sueño" },
  { key: "mood", label: "Ánimo" },
];

/** Puntos por hora. Los valores altos siempre son "buenos" (100 de hambre = lleno). */
const RATES = {
  awake: { hunger: -5, energy: -6, mood: -3 },
  asleep: { hunger: -2.5, energy: 30, mood: -1 },
};

// ---------------- muerte ----------------

// Cuidarla = alimentarla, darle mimos, registrar cosas en el gestor o hacer pomodoros.
// Las moscas que caza sola no cuentan. Pasados LONELY_GRACE_DAYS sin cuidados, su salud objetivo
// baja LONELY_PENALTY por día: con descuido total se muere en ~1 semana (avisando antes).
const LONELY_GRACE_DAYS = 2;
const LONELY_PENALTY = 12;

export function markCare(pet) {
  pet.lastCare = Date.now();
}

export function daysWithoutCare(pet) {
  return (Date.now() - (pet.lastCare ?? Date.now())) / DAY_MS;
}

/** Por debajo de esta salud la mascota está "crítica". */
export const CRITICAL_HEALTH = 5;
/** Tiempo seguido en estado crítico hasta morir. */
export const DEATH_AFTER_MS = 24 * 3600 * 1000;

// ---------------- experiencia ----------------
// Un día de uso moderado (unas 5 h de compu, 2–3 registros, un par de pomodoros, algunos mimos)
// da ~150–180 XP. Como cada nivel pide 7 XP más que el anterior, se sube ~1 nivel por día al
// principio y un poco más lento después, sin paredes. Los topes diarios evitan "farmear".
export const XP_SOURCES = {
  presence: { xp: 1, cap: 60, label: "Compañía (1 cada 5 min)" },
  fly: { xp: 1, cap: 20, label: "Moscas" },
  record: { xp: 8, cap: 64, label: "Registros en el gestor" },
  pomodoro: { xp: 15, cap: 60, label: "Pomodoros" },
  pet: { xp: 1, cap: 10, label: "Mimos" },
  feed: { xp: 2, cap: 10, label: "Comida" },
  streak: { xp: 0, cap: 40, label: "Racha diaria" },
};
const PRESENCE_EVERY_S = 5 * 60;

export const xpToNext = (level) => 110 + 7 * (level - 1);

const clamp = (v) => Math.min(100, Math.max(0, v));
const todayKey = () => {
  const d = new Date(Date.now());
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** Mascota nueva (nivel 1). `adopted: false` hace que el widget muestre la pantalla de adopción. */
export function newPet({ species = "sapo", name, adopted = true } = {}) {
  return {
    species,
    name: name || SPECIES[species].defaultName,
    adopted,
    alive: true,
    bornAt: Date.now(),
    stats: { health: 85, hunger: 75, energy: 80, mood: 75 },
    xp: 0,
    level: 1,
    totalXp: 0,
    habitScore: 70,
    flies: 0,
    recordCounts: null,
    dnd: null,
    criticalSince: null,
    lastCare: Date.now(),
    daily: { day: todayKey(), earned: {}, presenceAcc: 0 },
    streak: { last: null, count: 0 },
    equipped: [],
    lastTick: Date.now(),
  };
}

export function loadPet() {
  let pet;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.stats) {
      // Mascotas de antes de las especies: eran sapos y ya estaban adoptadas.
      const base = newPet({ species: saved.species || "sapo" });
      pet = { ...base, ...saved, stats: { ...base.stats, ...saved.stats }, daily: { ...base.daily, ...saved.daily } };
      if (saved.adopted === undefined) pet.adopted = true;
      if (saved.alive === undefined) pet.alive = true;
      if (saved.totalXp === undefined) pet.totalXp = 0;
      if (saved.lastCare === undefined) pet.lastCare = Date.now();
    }
  } catch {
    /* dato corrupto: arrancamos de cero */
  }
  if (!pet) {
    pet = newPet({ adopted: false });
    try {
      pet.flies = Number(localStorage.getItem(LEGACY_FLIES_KEY)) || 0;
    } catch {
      /* sin storage */
    }
  }
  if (pet.alive && pet.adopted) {
    const elapsed = Math.min(MAX_CATCH_UP_S, Math.max(0, (Date.now() - pet.lastTick) / 1000));
    if (elapsed > 60) tickPet(pet, elapsed, { asleep: true, offline: true });
  }
  pet.lastTick = Date.now();
  return pet;
}

export function savePet(pet) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pet));
  } catch {
    /* sin storage: la mascota vive solo en memoria */
  }
}

/**
 * Avanza el tiempo `seconds`. La salud tiende al promedio de las otras necesidades y los hábitos.
 * Devuelve { presenceXp } con la XP de compañía ganada (solo despierto y con la compu en uso).
 */
export function tickPet(pet, seconds, { asleep, offline = false }) {
  if (!pet.alive || !pet.adopted) {
    pet.lastTick = Date.now();
    return { presenceXp: 0 };
  }
  const h = seconds / HOUR;
  const s = pet.stats;
  const rate = asleep ? RATES.asleep : RATES.awake;
  s.hunger = clamp(s.hunger + rate.hunger * h);
  s.energy = clamp(s.energy + rate.energy * h);
  let moodRate = rate.mood;
  if (s.hunger < 25) moodRate -= 4;
  if (s.energy < 20) moodRate -= 3;
  // Mucho tiempo sin verte (compu apagada) lo pone triste.
  if (offline && seconds > 24 * HOUR) moodRate -= 1.5;
  s.mood = clamp(s.mood + moodRate * h);

  const lonely = Math.max(0, daysWithoutCare(pet) - LONELY_GRACE_DAYS) * LONELY_PENALTY;
  const target = Math.max(0, 0.3 * s.hunger + 0.25 * s.energy + 0.2 * s.mood + 0.25 * pet.habitScore - lonely);
  const step = 8 * h;
  s.health = clamp(s.health + Math.max(-step, Math.min(step, target - s.health)));

  const now = Date.now();
  if (s.health < CRITICAL_HEALTH) pet.criticalSince ??= now - (offline ? seconds * 1000 : 0);
  else if (s.health >= CRITICAL_HEALTH * 3) pet.criticalSince = null;
  pet.lastTick = now;

  let presenceXp = 0;
  if (!asleep && !offline) {
    rollDay(pet);
    pet.daily.presenceAcc = (pet.daily.presenceAcc || 0) + seconds;
    while (pet.daily.presenceAcc >= PRESENCE_EVERY_S) {
      pet.daily.presenceAcc -= PRESENCE_EVERY_S;
      presenceXp += 1;
    }
  }
  return { presenceXp };
}

/** ¿Pasó demasiado tiempo en estado crítico? */
export function shouldDie(pet) {
  return pet.alive && pet.adopted && pet.criticalSince != null && Date.now() - pet.criticalSince >= DEATH_AFTER_MS;
}

/** Horas que le quedan antes de morir si sigue crítica (null si no está crítica). */
export function hoursToDeath(pet) {
  if (pet.criticalSince == null) return null;
  return Math.max(0, (DEATH_AFTER_MS - (Date.now() - pet.criticalSince)) / 3_600_000);
}

export function boost(pet, delta) {
  if (!pet.alive || !pet.adopted) return;
  for (const [k, v] of Object.entries(delta)) pet.stats[k] = clamp(pet.stats[k] + v);
}

function rollDay(pet) {
  const day = todayKey();
  if (pet.daily?.day !== day) pet.daily = { day, earned: {}, presenceAcc: 0 };
}

/** XP que todavía se puede ganar hoy de una fuente. */
export function remainingToday(pet, source) {
  rollDay(pet);
  return Math.max(0, XP_SOURCES[source].cap - (pet.daily.earned[source] || 0));
}

/**
 * Suma XP de una fuente respetando el tope diario.
 * @returns {{ gained: number, leveled: boolean, unlocked: Array, streakBonus: number }}
 */
export function earnXp(pet, source, units = 1) {
  const result = { gained: 0, leveled: false, unlocked: [], streakBonus: 0 };
  if (!pet.alive || !pet.adopted) return result;
  rollDay(pet);
  // Racha: el primer XP del día suma un bonus que crece con los días seguidos (tope 40).
  if (!pet.daily.earned.streak) {
    const yesterday = new Date(Date.now() - DAY_MS);
    const yKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
    pet.streak = { last: todayKey(), count: pet.streak?.last === yKey ? (pet.streak.count || 0) + 1 : 1 };
    result.streakBonus = Math.min(XP_SOURCES.streak.cap, 10 + 3 * (pet.streak.count - 1));
    pet.daily.earned.streak = result.streakBonus;
  }
  const amount = Math.min(XP_SOURCES[source].xp * units, remainingToday(pet, source));
  pet.daily.earned[source] = (pet.daily.earned[source] || 0) + amount;
  result.gained = amount + result.streakBonus;
  const before = pet.level;
  pet.xp += result.gained;
  pet.totalXp = (pet.totalXp || 0) + result.gained;
  while (pet.xp >= xpToNext(pet.level)) {
    pet.xp -= xpToNext(pet.level);
    pet.level += 1;
  }
  result.leveled = pet.level > before;
  result.unlocked = ACCESSORIES.filter((a) => a.level > before && a.level <= pet.level);
  return result;
}

/** XP ganada hoy (sin contar la racha) y el máximo posible. */
export function todayProgress(pet) {
  rollDay(pet);
  const sources = Object.keys(XP_SOURCES).filter((k) => k !== "streak");
  return {
    earned: sources.reduce((s, k) => s + (pet.daily.earned[k] || 0), 0) + (pet.daily.earned.streak || 0),
    max: sources.reduce((s, k) => s + XP_SOURCES[k].cap, 0),
    streak: pet.streak?.count || 0,
  };
}

// ---------------- accesorios ----------------

export const unlockedAccessories = (pet) => ACCESSORIES.filter((a) => a.level <= pet.level);

export function toggleAccessory(pet, id) {
  const acc = ACCESSORIES.find((a) => a.id === id);
  if (!acc || acc.level > pet.level) return;
  const on = pet.equipped.includes(id);
  // Un accesorio por "lugar" (cabeza, cara, cuello…): equipar uno saca al anterior del mismo lugar.
  pet.equipped = pet.equipped.filter((e) => e !== id && ACCESSORIES.find((a) => a.id === e)?.slot !== acc.slot);
  if (!on) pet.equipped.push(id);
}

// ---------------- muerte e historial ----------------

export function ageDays(pet) {
  return Math.floor(((pet.diedAt ?? Date.now()) - pet.bornAt) / DAY_MS);
}

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

/** Marca la mascota como muerta y la guarda en el historial. */
export function killPet(pet) {
  pet.alive = false;
  pet.diedAt = Date.now();
  pet.dnd = null;
  const entry = { name: pet.name, species: pet.species, level: pet.level, days: ageDays(pet), flies: pet.flies, diedAt: pet.diedAt };
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...loadHistory()].slice(0, 30)));
  } catch {
    /* sin storage */
  }
}

/** Reemplaza el contenido de `pet` (se usa el mismo objeto porque el widget guarda una referencia). */
export function adoptInto(pet, { species, name }) {
  const fresh = newPet({ species, name });
  // Lo que es del usuario y no de la mascota se conserva.
  fresh.habitScore = pet.habitScore;
  fresh.recordCounts = pet.recordCounts;
  for (const k of Object.keys(pet)) delete pet[k];
  Object.assign(pet, fresh);
}

// ---------------- textos ----------------

const WORDS = {
  health: [[70, "Sano"], [40, "Regular"], [15, "Enfermo"], [0, "Muy grave"]],
  hunger: [[70, "Satisfecho"], [35, "Con hambre"], [0, "Famélico"]],
  energy: [[70, "Descansado"], [35, "Cansado"], [0, "Agotado"]],
  mood: [[70, "Feliz"], [40, "Tranqui"], [0, "Triste"]],
};

export function statusWord(key, value) {
  return WORDS[key].find(([min]) => value >= min)[1];
}

/** Resumen de una línea del estado general, priorizando la necesidad más urgente. */
export function moodSummary(pet) {
  const s = pet.stats;
  if (!pet.alive) return { text: "Murió", tone: "bad" };
  if (pet.dnd) return { text: "Durmiendo", tone: "calm" };
  if (pet.criticalSince != null) return { text: "¡Grave!", tone: "bad" };
  if (s.health < 30) return { text: "Se siente mal", tone: "bad" };
  if (s.hunger < 25) return { text: "Tiene hambre", tone: "bad" };
  if (s.energy < 25) return { text: "Tiene sueño", tone: "warn" };
  if (s.mood < 30) return { text: "Está triste", tone: "warn" };
  if (s.mood >= 75 && s.health >= 70) return { text: "Muy feliz", tone: "good" };
  return { text: "Tranquilo", tone: "calm" };
}
