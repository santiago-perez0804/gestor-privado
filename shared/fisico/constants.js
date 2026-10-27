// Vocabulario de Físico compartido por el server, la web y (a futuro) el backend en la nube.
// Sin dependencias: se puede importar desde Node y desde el navegador.

/** Los 13 músculos que se cuentan para el volumen semanal (id → nombre). */
export const MUSCLES = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombro_anterior: "Hombro anterior",
  hombro_lateral: "Hombro lateral",
  deltoide_posterior: "Deltoide posterior",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebrazo: "Antebrazo",
  cuadriceps: "Cuádriceps",
  isquiotibiales: "Isquiotibiales",
  gluteo: "Glúteo",
  gemelos: "Gemelos",
  abdomen: "Abdomen",
};
export const MUSCLE_IDS = Object.keys(MUSCLES);

/** Equipos (id → nombre). Cada uno tiene su paso de progresión configurable. */
export const EQUIPMENT = {
  barra: "Barra",
  mancuernas: "Mancuernas",
  polea: "Polea",
  maquina: "Máquina",
  peso_corporal: "Peso corporal",
  otro: "Otro",
};
export const EQUIPMENT_IDS = Object.keys(EQUIPMENT);

/** Tipos de serie. Solo las "working" completadas cuentan para volumen, récords y progresión. */
export const SET_TYPES = ["warmup", "working", "drop", "failure"];
export const SESSION_STATUSES = ["in_progress", "done", "discarded"];

/** Zonas de medición, con dónde medir (para la medición guiada). */
export const ZONES = {
  cintura: { label: "Cintura", how: "A la altura del ombligo, parado y relajado, al final de soltar el aire. Sin meter panza." },
  brazo: { label: "Brazo", how: "En la parte más ancha del bíceps, con el brazo contraído y el codo a la altura del hombro." },
  pecho: { label: "Pecho", how: "A la altura de los pezones, con los brazos al costado y respirando normal." },
  hombros: { label: "Hombros", how: "Rodeando los dos hombros en la parte más ancha, con los brazos relajados." },
  muslo: { label: "Muslo", how: "En la parte más ancha del muslo, parado con el peso repartido en las dos piernas." },
  cuello: { label: "Cuello", how: "Justo debajo de la nuez, con la cinta horizontal y sin apretar." },
};
export const ZONE_IDS = Object.keys(ZONES);
/** Zonas que pueden venir de datos viejos (se conservan aunque no se midan más). */
export const LEGACY_ZONES = { cadera: { label: "Cadera", how: "En la parte más ancha de la cadera." } };

export const POSES = { front: "Frente", side: "Perfil", back: "Espalda" };
export const VARIANTS = { relaxed: "Relajado", flexed: "Contraído" };

/** Actividades sin rutina que se pueden poner en la agenda (etiquetas). */
export const EXTRA_ACTIVITIES = ["calistenia", "bici", "caminata", "correr", "natación", "fútbol", "movilidad"];

/** Ajustes por defecto (se guardan solo los que el usuario cambia, en settings "fisico.settings"). */
export const DEFAULT_SETTINGS = {
  timeZone: "America/Argentina/Buenos_Aires",
  heightCm: null,
  // Volumen semanal de referencia por músculo (series).
  volumeRange: { min: 10, max: 20 },
  // Ritmo saludable de cambio de peso, en % del peso por semana (Garthe et al., 2011).
  healthyRatePct: { min: 0.25, max: 0.7 },
  // Una semana cuenta como cumplida con este porcentaje de entrenos hechos.
  weekDoneThreshold: 0.8,
  // Aviso de posible error de tipeo: salto contra la tendencia (kg).
  typoJumpKg: 3,
  // Paso de progresión por equipo (kg). Polea/máquina: un paso de la pila.
  progressionStepKg: { barra: 2.5, mancuernas: 2, polea: 2.5, maquina: 5, peso_corporal: 2.5, otro: 2.5 },
  // Barras (kg) y discos disponibles (kg → cantidad de pares, o sea uno por lado).
  bars: { olimpica: 20, z: 10 },
  plates: { 25: 2, 20: 2, 15: 1, 10: 2, 5: 2, 2.5: 2, 1.25: 2 },
  // Calentamiento: descanso fijo.
  warmupRestSeconds: 60,
  // Medidas y fotos: cada cuántos días.
  measureEveryDays: 14,
  photoEveryDays: 14,
  // "Va bien" por zona: 'down' (que baje), 'up' (que suba) o 'neutral'.
  zoneDirection: { cintura: "down", brazo: "up", pecho: "up", hombros: "up", muslo: "neutral", cuello: "neutral", cadera: "neutral" },
};

/** Ajustes efectivos: los guardados encima de los por defecto (un nivel de profundidad). */
export function mergeSettings(saved = {}) {
  const out = { ...DEFAULT_SETTINGS };
  for (const [k, v] of Object.entries(saved || {})) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    const def = DEFAULT_SETTINGS[k];
    out[k] = def && typeof def === "object" && !Array.isArray(def) && v && typeof v === "object" ? { ...def, ...v } : v;
  }
  return out;
}
