// Ocio. Modelo:
//   works            una obra (película, serie, libro, juego): datos de catálogo, iguales para todos
//   library_entries  tu relación con esa obra (una por obra): estado, puntuación, prioridad, formato
//   passes           cada vez que la leíste / viste / jugaste (relecturas = varias pasadas)
//   reviews          reseñas (de una pasada) · highlights: subrayados y notas
//   reading_sessions sesiones de lectura (KOReader o a mano): base de las estadísticas
//   artworks         galería · ocio_goals: metas anuales · outings: salidas (+ vínculo con gastos)
// Fechas: YYYY-MM-DD (o ISO completo en timestamps). Listas y metadatos: JSON en TEXT.
export const ocioSchema = `
-- Legado (antes del rediseño). Se conserva intacta como respaldo; la migración ocioV2 copia sus datos.
CREATE TABLE IF NOT EXISTS media_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('pelicula','serie','libro','videojuego')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','en_progreso','completado','abandonado')),
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  notes TEXT,
  startedAt TEXT,
  finishedAt TEXT,
  progressCurrent INTEGER,
  progressTotal INTEGER,
  progressLabel TEXT,
  icon TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('movie','series','book','game')),
  title TEXT NOT NULL,
  originalTitle TEXT,
  creators TEXT NOT NULL DEFAULT '[]',
  year INTEGER,
  genres TEXT NOT NULL DEFAULT '[]',
  coverUrl TEXT,
  coverPath TEXT,
  externalSource TEXT,
  externalId TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_works_external ON works(externalSource, externalId) WHERE externalId IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_works_type ON works(type);

CREATE TABLE IF NOT EXISTS library_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workId INTEGER NOT NULL UNIQUE REFERENCES works(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'want' CHECK(status IN ('want','in_progress','done','dropped')),
  rating REAL CHECK(rating IS NULL OR (rating BETWEEN 0.5 AND 5 AND rating * 2 = CAST(rating * 2 AS INTEGER))),
  priority INTEGER CHECK(priority IS NULL OR priority BETWEEN 1 AND 3),
  recommendedBy TEXT,
  format TEXT,
  notes TEXT,
  legacyMediaItemId INTEGER UNIQUE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_library_entries_status ON library_entries(status);

CREATE TABLE IF NOT EXISTS passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entryId INTEGER NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
  number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','done','dropped')),
  startedAt TEXT,
  finishedAt TEXT,
  progress TEXT NOT NULL DEFAULT '{}',
  dropReason TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_passes_entry ON passes(entryId);
CREATE INDEX IF NOT EXISTS idx_passes_finishedAt ON passes(finishedAt);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entryId INTEGER NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
  passId INTEGER REFERENCES passes(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  hasSpoilers INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_entry ON reviews(entryId);

CREATE TABLE IF NOT EXISTS highlights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workId INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  location TEXT,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_highlights_work ON highlights(workId);

CREATE TABLE IF NOT EXISTS reading_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workId INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  startTime TEXT NOT NULL,
  durationSeconds INTEGER NOT NULL,
  pagesRead INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('koreader','manual')),
  externalKey TEXT UNIQUE,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_work ON reading_sessions(workId, startTime);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_start ON reading_sessions(startTime);

CREATE TABLE IF NOT EXISTS artworks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  technique TEXT,
  sizeLabel TEXT,
  createdOn TEXT,
  description TEXT,
  inventoryCode TEXT UNIQUE,
  imagePath TEXT NOT NULL,
  thumbPath TEXT,
  width INTEGER,
  height INTEGER,
  mime TEXT,
  isFavorite INTEGER NOT NULL DEFAULT 0,
  showOnEasel INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ocio_goals (
  year INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('movie','series','book','game','outing')),
  target INTEGER NOT NULL CHECK(target > 0),
  PRIMARY KEY (year, type)
);

-- Caché de catálogos externos (TMDB, Open Library, Google Books, RAWG): respuestas normalizadas.
CREATE TABLE IF NOT EXISTS catalog_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  fetchedAt TEXT NOT NULL
);

-- Google Calendar (una sola cuenta): token de actualización cifrado, calendario y estado de la
-- sincronización. El token de acceso vive solo en memoria.
CREATE TABLE IF NOT EXISTS google_account (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  refreshTokenEnc TEXT,
  email TEXT,
  calendarId TEXT,
  calendarName TEXT,
  syncToken TEXT,
  lastSyncAt TEXT,
  lastError TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK(status IN ('disconnected','connected','revoked','error')),
  updatedAt TEXT NOT NULL
);

-- Registro simple de la sincronización (conflictos y errores), para revisar qué pasó.
CREATE TABLE IF NOT EXISTS google_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('conflict','error','info')),
  message TEXT NOT NULL,
  outingId INTEGER
);

-- Salidas (forma nueva). En bases anteriores al rediseño, la migración ocioV2 reconstruye la tabla
-- (y crea sus índices y el vínculo con gastos), porque SQLite no permite cambiar los CHECK.
CREATE TABLE IF NOT EXISTS outings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,
  date TEXT NOT NULL,
  startTime TEXT,
  endTime TEXT,
  allDay INTEGER NOT NULL DEFAULT 1,
  place TEXT,
  withWhom TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'tentative' CHECK(status IN ('tentative','confirmed','attended','not_attended')),
  icon TEXT,
  source TEXT NOT NULL DEFAULT 'app' CHECK(source IN ('app','google')),
  googleEventId TEXT UNIQUE,
  googleEtag TEXT,
  googleUpdated TEXT,
  deletedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
`;
