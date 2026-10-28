import { db, nowIso } from "../db/index.js";

export default function registerPlansRoutes(app) {
  app.get("/api/plans", async (req, res) => {
    const rows = await db
      .prepare(
        `SELECT p.*, (SELECT COUNT(*) FROM routines r WHERE r.planId = p.id) as routineCount
         FROM plans p ORDER BY p.createdAt DESC`
      )
      .all();
    res.json(rows);
  });

  app.post("/api/plans", async (req, res) => {
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ error: "name_required" });
    const ts = nowIso();
    const info = await db
      .prepare("INSERT INTO plans (name, description, icon, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)")
      .run(name, description ?? null, icon ?? null, ts, ts);
    res.status(201).json(await db.prepare("SELECT * FROM plans WHERE id = ?").get(info.lastInsertRowid));
  });

  app.get("/api/plans/:id", async (req, res) => {
    const plan = await db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.id);
    if (!plan) return res.status(404).json({ error: "not_found" });
    const routines = await db
      .prepare("SELECT * FROM routines WHERE planId = ? ORDER BY sortOrder ASC, createdAt ASC")
      .all(req.params.id);
    res.json({ ...plan, routines });
  });

  app.put("/api/plans/:id", async (req, res) => {
    const existing = await db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const name = req.body.name ?? existing.name;
    const description = req.body.description ?? existing.description;
    const icon = req.body.icon !== undefined ? req.body.icon : existing.icon;
    await db.prepare("UPDATE plans SET name = ?, description = ?, icon = ?, updatedAt = ? WHERE id = ?").run(
      name,
      description,
      icon,
      nowIso(),
      req.params.id
    );
    res.json(await db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/plans/:id", async (req, res) => {
    await db.prepare("DELETE FROM plans WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
