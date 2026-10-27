import { db, nowIso } from "../db/index.js";

export default function registerWeightsRoutes(app) {
  app.get("/api/weights", (req, res) => {
    const rows = db.prepare("SELECT * FROM weights ORDER BY recordedAt DESC").all();
    res.json(rows);
  });

  // recordedAt: fecha y hora local del usuario ("2026-10-26T08:00"), así una pesada a las 00:30 es de ese día.
  const valid = (weight, recordedAt) => Number(weight) > 20 && Number(weight) < 400 && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(String(recordedAt || ""));

  app.post("/api/weights", (req, res) => {
    const { weight, recordedAt, note } = req.body;
    if (!weight || !recordedAt) return res.status(400).json({ error: "weight_and_recordedAt_required" });
    if (!valid(weight, recordedAt)) return res.status(400).json({ error: "invalid_weight" });
    const createdAt = nowIso();
    const info = db
      .prepare("INSERT INTO weights (weight, recordedAt, note, createdAt) VALUES (?, ?, ?, ?)")
      .run(Number(weight), recordedAt, note || null, createdAt);
    const row = db.prepare("SELECT * FROM weights WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(row);
  });

  app.put("/api/weights/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM weights WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const weight = req.body.weight ?? existing.weight;
    const recordedAt = req.body.recordedAt ?? existing.recordedAt;
    const note = req.body.note !== undefined ? req.body.note || null : existing.note;
    if (!valid(weight, recordedAt)) return res.status(400).json({ error: "invalid_weight" });
    db.prepare("UPDATE weights SET weight = ?, recordedAt = ?, note = ? WHERE id = ?").run(Number(weight), recordedAt, note, req.params.id);
    res.json(db.prepare("SELECT * FROM weights WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/weights/:id", (req, res) => {
    db.prepare("DELETE FROM weights WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
