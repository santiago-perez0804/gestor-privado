import { db, nowIso } from "../db/index.js";

export default function registerWeightsRoutes(app) {
  app.get("/api/weights", (req, res) => {
    const rows = db.prepare("SELECT * FROM weights ORDER BY recordedAt DESC").all();
    res.json(rows);
  });

  app.post("/api/weights", (req, res) => {
    const { weight, recordedAt } = req.body;
    if (!weight || !recordedAt) return res.status(400).json({ error: "weight_and_recordedAt_required" });
    const createdAt = nowIso();
    const info = db
      .prepare("INSERT INTO weights (weight, recordedAt, createdAt) VALUES (?, ?, ?)")
      .run(weight, recordedAt, createdAt);
    const row = db.prepare("SELECT * FROM weights WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(row);
  });

  app.put("/api/weights/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM weights WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const weight = req.body.weight ?? existing.weight;
    const recordedAt = req.body.recordedAt ?? existing.recordedAt;
    db.prepare("UPDATE weights SET weight = ?, recordedAt = ? WHERE id = ?").run(weight, recordedAt, req.params.id);
    res.json(db.prepare("SELECT * FROM weights WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/weights/:id", (req, res) => {
    db.prepare("DELETE FROM weights WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
