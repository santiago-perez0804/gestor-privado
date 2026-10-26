import { db, nowIso } from "../db/index.js";
import { getProfile, getRecentMedia, clearInstagramCache } from "../services/instagram.js";
import { recordTodaySnapshot, backfillFollowers } from "../services/instagramSync.js";

const TOKEN_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;

// Nunca exponer el token al cliente.
function publicProject(row) {
  if (!row) return row;
  const { accessToken, ...rest } = row;
  return { ...rest, connected: Boolean(accessToken) };
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const latestSnapshot = db.prepare(
  "SELECT * FROM project_snapshots WHERE projectId = ? AND followers IS NOT NULL ORDER BY date DESC LIMIT 1"
);
const snapshotOnOrBefore = db.prepare(
  "SELECT followers FROM project_snapshots WHERE projectId = ? AND date <= ? AND followers IS NOT NULL ORDER BY date DESC LIMIT 1"
);
const earliestSnapshot = db.prepare(
  "SELECT followers FROM project_snapshots WHERE projectId = ? AND followers IS NOT NULL ORDER BY date ASC LIMIT 1"
);
const sparkline = db.prepare(
  "SELECT date, followers FROM project_snapshots WHERE projectId = ? AND date >= ? AND followers IS NOT NULL ORDER BY date ASC"
);

// Diferencia de seguidores contra hace N días; si no hay historial tan viejo usa el snapshot más antiguo.
function followerDelta(projectId, latest, days) {
  if (!latest) return null;
  const base = snapshotOnOrBefore.get(projectId, daysAgo(days)) ?? earliestSnapshot.get(projectId);
  return base ? latest.followers - base.followers : null;
}

function withStats(row) {
  const latest = latestSnapshot.get(row.id);
  return {
    ...publicProject(row),
    latest: latest ?? null,
    delta7: followerDelta(row.id, latest, 7),
    delta30: followerDelta(row.id, latest, 30),
    sparkline: sparkline.all(row.id, daysAgo(30)),
  };
}

async function connectInstagram(projectId, token) {
  const profile = await getProfile(token, { fresh: true });
  const ts = nowIso();
  db.prepare(
    `UPDATE projects SET accessToken = ?, igUserId = ?, igUsername = ?, igProfilePictureUrl = ?,
     tokenIssuedAt = ?, tokenExpiresAt = ?, lastSyncError = NULL, updatedAt = ? WHERE id = ?`
  ).run(
    token,
    String(profile.user_id ?? profile.id),
    profile.username,
    profile.profile_picture_url ?? null,
    ts,
    new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString(),
    ts,
    projectId
  );
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  await recordTodaySnapshot(project, profile);
  await backfillFollowers(project, profile.followers_count);
}

export default function registerProjectsRoutes(app) {
  app.get("/api/projects", (req, res) => {
    const rows = db.prepare("SELECT * FROM projects ORDER BY createdAt ASC").all();
    res.json(rows.map(withStats));
  });

  app.get("/api/projects/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json(withStats(row));
  });

  app.post("/api/projects", async (req, res, next) => {
    const { name, description, type, icon, url, accessToken } = req.body;
    if (!name) return res.status(400).json({ error: "name_required" });
    const token = accessToken?.trim();
    if (token) {
      // Validar antes de crear, para no dejar proyectos a medio conectar.
      try {
        await getProfile(token, { fresh: true });
      } catch (err) {
        return res.status(400).json({ error: "invalid_token", message: err.message });
      }
    }
    try {
      const ts = nowIso();
      const info = db
        .prepare(
          `INSERT INTO projects (name, description, type, icon, url, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(name, description ?? null, type ?? "instagram", icon ?? null, url ?? null, ts, ts);
      if (token) await connectInstagram(info.lastInsertRowid, token);
      res.status(201).json(withStats(db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid)));
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/projects/:id", async (req, res, next) => {
    const existing = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const token = req.body.accessToken?.trim();
    if (token) {
      try {
        await connectInstagram(existing.id, token);
      } catch (err) {
        return res.status(400).json({ error: "invalid_token", message: err.message });
      }
    }
    try {
      const merged = { ...existing };
      for (const key of ["name", "description", "icon", "url"]) {
        if (req.body[key] !== undefined) merged[key] = req.body[key];
      }
      db.prepare("UPDATE projects SET name=?, description=?, icon=?, url=?, updatedAt=? WHERE id=?").run(
        merged.name,
        merged.description,
        merged.icon,
        merged.url,
        nowIso(),
        req.params.id
      );
      res.json(withStats(db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id)));
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    const existing = db.prepare("SELECT accessToken FROM projects WHERE id = ?").get(req.params.id);
    if (existing?.accessToken) clearInstagramCache(existing.accessToken);
    db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });

  // Datos en vivo: perfil + posts recientes. También actualiza el snapshot del día.
  app.get("/api/projects/:id/live", async (req, res) => {
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    if (!project.accessToken) return res.status(400).json({ error: "not_connected" });
    if (req.query.fresh === "1") clearInstagramCache(project.accessToken);
    try {
      const [profile, media] = await Promise.all([
        getProfile(project.accessToken),
        getRecentMedia(project.accessToken),
      ]);
      await recordTodaySnapshot(project, profile);
      res.json({
        fetchedAt: nowIso(),
        profile: {
          username: profile.username,
          name: profile.name ?? null,
          profilePictureUrl: profile.profile_picture_url ?? null,
          followers: profile.followers_count,
          follows: profile.follows_count,
          mediaCount: profile.media_count,
        },
        media: media.map((m) => ({
          id: m.id,
          caption: m.caption ?? "",
          mediaType: m.media_type,
          imageUrl: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url,
          permalink: m.permalink,
          timestamp: m.timestamp,
          likes: m.like_count ?? 0,
          comments: m.comments_count ?? 0,
        })),
      });
    } catch (err) {
      db.prepare("UPDATE projects SET lastSyncError = ? WHERE id = ?").run(err.message, project.id);
      res.status(502).json({ error: "instagram_unavailable", message: err.message });
    }
  });

  app.get("/api/projects/:id/snapshots", (req, res) => {
    const { from, to } = req.query;
    const clauses = ["projectId = ?"];
    const params = [req.params.id];
    if (from) {
      clauses.push("date >= ?");
      params.push(from);
    }
    if (to) {
      clauses.push("date <= ?");
      params.push(to);
    }
    res.json(
      db.prepare(`SELECT * FROM project_snapshots WHERE ${clauses.join(" AND ")} ORDER BY date ASC`).all(...params)
    );
  });
}
