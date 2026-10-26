export const ocioSchema = `
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

CREATE TABLE IF NOT EXISTS outings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,
  plannedDate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planeado' CHECK(status IN ('planeado','hecho','cancelado')),
  location TEXT,
  notes TEXT,
  icon TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(type);
CREATE INDEX IF NOT EXISTS idx_media_items_status ON media_items(status);
CREATE INDEX IF NOT EXISTS idx_outings_plannedDate ON outings(plannedDate);
CREATE INDEX IF NOT EXISTS idx_outings_status ON outings(status);
`;
