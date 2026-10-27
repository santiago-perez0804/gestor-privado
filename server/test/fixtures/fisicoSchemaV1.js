export const fisicoSchemaV1 = `
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

CREATE TABLE IF NOT EXISTS routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routineId INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exerciseLibraryId TEXT NOT NULL REFERENCES exercise_library(id),
  targetSets INTEGER,
  targetReps TEXT,
  targetWeight REAL,
  notes TEXT,
  sortOrder INTEGER NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_weights_recordedAt ON weights(recordedAt);
CREATE INDEX IF NOT EXISTS idx_routines_planId ON routines(planId);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routineId ON routine_exercises(routineId);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_exerciseLibraryId ON exercise_logs(exerciseLibraryId);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_recordedAt ON exercise_logs(recordedAt);
CREATE INDEX IF NOT EXISTS idx_exercise_library_equipment ON exercise_library(equipment);
CREATE INDEX IF NOT EXISTS idx_body_measurements_type_date ON body_measurements(type, date);
CREATE INDEX IF NOT EXISTS idx_progress_photos_date ON progress_photos(date);
`;
