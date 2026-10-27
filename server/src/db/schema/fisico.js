export const fisicoSchema = `
CREATE TABLE IF NOT EXISTS weights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weight REAL NOT NULL,
  recordedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercise_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  force TEXT,
  level TEXT,
  mechanic TEXT,
  equipment TEXT,
  primaryMuscles TEXT NOT NULL,
  secondaryMuscles TEXT NOT NULL,
  instructions TEXT NOT NULL,
  category TEXT,
  images TEXT
);

CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  planId INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Rediseño (fisicoV2): ejercicio de una rutina con su prescripción (series, rango de reps, descanso, RIR).
-- En bases viejas la tabla tenía otra forma (apuntaba a exercise_library); la migración la reconstruye.
CREATE TABLE IF NOT EXISTS routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routineId INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exerciseId INTEGER NOT NULL REFERENCES exercises(id),
  sortOrder INTEGER NOT NULL DEFAULT 0,
  sets INTEGER NOT NULL DEFAULT 3 CHECK(sets BETWEEN 1 AND 20),
  repMin INTEGER NOT NULL DEFAULT 8 CHECK(repMin BETWEEN 1 AND 100),
  repMax INTEGER NOT NULL DEFAULT 12 CHECK(repMax >= repMin AND repMax <= 100),
  restSeconds INTEGER NOT NULL DEFAULT 120 CHECK(restSeconds BETWEEN 0 AND 1800),
  rirMin REAL,
  rirMax REAL,
  supersetGroup TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exerciseLibraryId TEXT NOT NULL REFERENCES exercise_library(id),
  routineId INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  recordedAt TEXT NOT NULL,
  weight REAL,
  sets INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  notes TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS body_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('cintura','brazo','pecho','muslo','cuello','cadera')),
  value REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  fileName TEXT NOT NULL,
  notes TEXT,
  createdAt TEXT NOT NULL
);

-- ---------- Rediseño de Físico (fisicoV2) ----------
-- Biblioteca propia en español: músculos como JSON [{ muscle, role: 'primary'|'secondary' }].
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  equipment TEXT NOT NULL DEFAULT 'otro' CHECK(equipment IN ('barra','mancuernas','polea','maquina','peso_corporal','otro')),
  bar TEXT CHECK(bar IS NULL OR bar IN ('olimpica','z')),
  isBodyweight INTEGER NOT NULL DEFAULT 0,
  muscles TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  isCustom INTEGER NOT NULL DEFAULT 0,
  sourceLibraryId TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Agenda semanal del plan: día (1 = lunes … 7 = domingo) → rutina o descanso, más actividades sin rutina.
CREATE TABLE IF NOT EXISTS plan_schedule (
  planId INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),
  routineId INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  extras TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (planId, weekday)
);

-- Entrenos. Los ids son UUID generados en el cliente: el celular crea la sesión y las series sin
-- esperar al server (y se suben con un snapshot idempotente).
CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY,
  planId INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  routineId INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  endedAt TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','done','discarded')),
  localDate TEXT NOT NULL,
  bodyweightKg REAL,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS set_logs (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exerciseId INTEGER NOT NULL REFERENCES exercises(id),
  exerciseOrder INTEGER NOT NULL,
  setOrder INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'working' CHECK(type IN ('warmup','working','drop','failure')),
  weightKg REAL,
  reps INTEGER CHECK(reps IS NULL OR reps BETWEEN 0 AND 200),
  rir REAL,
  completedAt TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('weight')),
  target REAL NOT NULL,
  targetDate TEXT,
  achievedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Medidas: una sesión de medición (guiada) con un valor por zona.
CREATE TABLE IF NOT EXISTS measurement_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  measuredOn TEXT NOT NULL,
  notes TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId INTEGER NOT NULL REFERENCES measurement_sessions(id) ON DELETE CASCADE,
  measuredOn TEXT NOT NULL,
  zone TEXT NOT NULL,
  valueCm REAL NOT NULL CHECK(valueCm > 0 AND valueCm < 400),
  legacyId INTEGER UNIQUE,
  createdAt TEXT NOT NULL,
  UNIQUE (sessionId, zone)
);

-- Fotos de progreso: privadas (fuera de toda carpeta pública), por sesión, pose y variante.
CREATE TABLE IF NOT EXISTS photo_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  note TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId INTEGER NOT NULL REFERENCES photo_sessions(id) ON DELETE CASCADE,
  pose TEXT NOT NULL DEFAULT 'front' CHECK(pose IN ('front','side','back')),
  variant TEXT NOT NULL DEFAULT 'relaxed' CHECK(variant IN ('relaxed','flexed')),
  fileKey TEXT NOT NULL UNIQUE,
  thumbKey TEXT,
  mime TEXT,
  width INTEGER,
  height INTEGER,
  note TEXT,
  legacyId INTEGER UNIQUE,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  targetLabel TEXT,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
  habitId INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  localDate TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (habitId, localDate)
);

CREATE INDEX IF NOT EXISTS idx_weights_recordedAt ON weights(recordedAt);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(localDate);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_status ON workout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_set_logs_session ON set_logs(sessionId);
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exerciseId, completedAt);
CREATE INDEX IF NOT EXISTS idx_measurements_zone ON measurements(zone, measuredOn);
CREATE INDEX IF NOT EXISTS idx_photos_session ON photos(sessionId);
CREATE INDEX IF NOT EXISTS idx_routines_planId ON routines(planId);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routineId ON routine_exercises(routineId);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_exerciseLibraryId ON exercise_logs(exerciseLibraryId);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_recordedAt ON exercise_logs(recordedAt);
CREATE INDEX IF NOT EXISTS idx_exercise_library_equipment ON exercise_library(equipment);
CREATE INDEX IF NOT EXISTS idx_body_measurements_type_date ON body_measurements(type, date);
CREATE INDEX IF NOT EXISTS idx_progress_photos_date ON progress_photos(date);
`;
