export const proyectosSchema = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'instagram' CHECK(type IN ('instagram')),
  icon TEXT,
  url TEXT,
  igUserId TEXT,
  igUsername TEXT,
  igProfilePictureUrl TEXT,
  accessToken TEXT,
  tokenIssuedAt TEXT,
  tokenExpiresAt TEXT,
  lastSyncAt TEXT,
  lastSyncError TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  followers INTEGER,
  follows INTEGER,
  mediaCount INTEGER,
  reach INTEGER,
  views INTEGER,
  profileViews INTEGER,
  accountsEngaged INTEGER,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(projectId, date)
);

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  issuer TEXT,
  issuedAt TEXT,
  expiresAt TEXT,
  hours REAL,
  credentialId TEXT,
  verifyUrl TEXT,
  skills TEXT,
  notes TEXT,
  fileName TEXT,
  mimeType TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_snapshots_project_date ON project_snapshots(projectId, date);
CREATE INDEX IF NOT EXISTS idx_certificates_issuedAt ON certificates(issuedAt);
`;
