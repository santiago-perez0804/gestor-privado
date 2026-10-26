import { db, nowIso } from "../db/index.js";
import { todayDateInputValue } from "../lib/billingMonth.js";
import {
  getProfile,
  getTodayInsights,
  getFollowerDeltas,
  refreshLongLivedToken,
  clearInstagramCache,
} from "./instagram.js";

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REFRESH_BEFORE_MS = 10 * 24 * 60 * 60 * 1000;
const MIN_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

function upsertSnapshot(projectId, date, values) {
  const ts = nowIso();
  db.prepare(
    `INSERT INTO project_snapshots
      (projectId, date, followers, follows, mediaCount, reach, views, profileViews, accountsEngaged, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(projectId, date) DO UPDATE SET
       followers = COALESCE(excluded.followers, followers),
       follows = COALESCE(excluded.follows, follows),
       mediaCount = COALESCE(excluded.mediaCount, mediaCount),
       reach = COALESCE(excluded.reach, reach),
       views = COALESCE(excluded.views, views),
       profileViews = COALESCE(excluded.profileViews, profileViews),
       accountsEngaged = COALESCE(excluded.accountsEngaged, accountsEngaged),
       updatedAt = excluded.updatedAt`
  ).run(
    projectId,
    date,
    values.followers ?? null,
    values.follows ?? null,
    values.mediaCount ?? null,
    values.reach ?? null,
    values.views ?? null,
    values.profileViews ?? null,
    values.accountsEngaged ?? null,
    ts,
    ts
  );
}

// Guarda el snapshot de hoy con los datos ya traídos del perfil (y los insights si están disponibles).
export async function recordTodaySnapshot(project, profile) {
  let insights = {};
  try {
    insights = await getTodayInsights(project.igUserId, project.accessToken);
  } catch {
    /* las métricas de interacción son opcionales; los seguidores alcanzan para el snapshot */
  }
  upsertSnapshot(project.id, todayDateInputValue(), {
    followers: profile.followers_count,
    follows: profile.follows_count,
    mediaCount: profile.media_count,
    ...insights,
  });
  db.prepare(
    "UPDATE projects SET igUsername = ?, igProfilePictureUrl = ?, lastSyncAt = ?, lastSyncError = NULL WHERE id = ?"
  ).run(profile.username, profile.profile_picture_url ?? null, nowIso(), project.id);
}

// Reconstruye hacia atrás la cantidad de seguidores con los deltas diarios que da la API (si los da).
// Solo completa días que todavía no tienen snapshot propio.
export async function backfillFollowers(project, currentFollowers) {
  const deltas = await getFollowerDeltas(project.igUserId, project.accessToken);
  if (!deltas.length) return;
  const today = todayDateInputValue();
  const sorted = deltas.filter((d) => d.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const exists = db.prepare("SELECT 1 FROM project_snapshots WHERE projectId = ? AND date = ?");
  let followers = currentFollowers;
  for (const { date, delta } of sorted) {
    // El total al cierre de ese día es el actual menos lo ganado en los días posteriores.
    if (!exists.get(project.id, date)) upsertSnapshot(project.id, date, { followers });
    followers -= delta ?? 0;
  }
}

async function maybeRefreshToken(project) {
  const expiresAt = project.tokenExpiresAt ? Date.parse(project.tokenExpiresAt) : null;
  const tokenAge = Date.now() - Date.parse(project.tokenIssuedAt || project.createdAt);
  const needsRefresh = !expiresAt || expiresAt - Date.now() < REFRESH_BEFORE_MS;
  // Instagram solo permite refrescar tokens con más de 24 h de antigüedad.
  if (!needsRefresh || tokenAge < MIN_TOKEN_AGE_MS) return project;
  const { accessToken, expiresAt: newExpiry } = await refreshLongLivedToken(project.accessToken);
  clearInstagramCache(project.accessToken);
  db.prepare("UPDATE projects SET accessToken = ?, tokenIssuedAt = ?, tokenExpiresAt = ? WHERE id = ?").run(
    accessToken,
    nowIso(),
    newExpiry,
    project.id
  );
  return { ...project, accessToken, tokenExpiresAt: newExpiry };
}

export async function syncInstagramProject(project) {
  try {
    const current = await maybeRefreshToken(project);
    const profile = await getProfile(current.accessToken, { fresh: true });
    await recordTodaySnapshot(current, profile);
  } catch (err) {
    db.prepare("UPDATE projects SET lastSyncError = ? WHERE id = ?").run(err.message, project.id);
  }
}

export async function syncInstagramProjects() {
  const projects = db
    .prepare("SELECT * FROM projects WHERE type = 'instagram' AND accessToken IS NOT NULL")
    .all();
  for (const p of projects) await syncInstagramProject(p);
}

export function startInstagramSync() {
  syncInstagramProjects().catch((err) => console.error("[instagram-sync]", err));
  setInterval(() => {
    syncInstagramProjects().catch((err) => console.error("[instagram-sync]", err));
  }, SYNC_INTERVAL_MS).unref();
}
