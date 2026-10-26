import { db, nowIso } from "../db/index.js";

export default function registerExerciseLogsRoutes(app) {
  app.get("/api/exercise-logs/records", (req, res) => {
    const { exerciseLibraryId } = req.query;

    if (exerciseLibraryId) {
      const row = db
        .prepare(
          `SELECT *, (weight * (1 + reps / 30.0)) AS estOneRm
           FROM exercise_logs
           WHERE exerciseLibraryId = ? AND weight IS NOT NULL AND weight > 0
           ORDER BY (weight * (1 + reps / 30.0)) DESC, recordedAt DESC
           LIMIT 1`
        )
        .get(exerciseLibraryId);
      return res.json(row ?? null);
    }

    const rows = db
      .prepare(
        `WITH ranked AS (
           SELECT el.*, (el.weight * (1 + el.reps / 30.0)) AS estOneRm,
             ROW_NUMBER() OVER (
               PARTITION BY el.exerciseLibraryId
               ORDER BY (el.weight * (1 + el.reps / 30.0)) DESC, el.recordedAt DESC
             ) AS rnk
           FROM exercise_logs el
           WHERE el.weight IS NOT NULL AND el.weight > 0
         )
         SELECT r.id, r.exerciseLibraryId, r.recordedAt, r.weight, r.sets, r.reps, r.estOneRm,
                ex.name AS exerciseName, ex.primaryMuscles
         FROM ranked r
         JOIN exercise_library ex ON ex.id = r.exerciseLibraryId
         WHERE r.rnk = 1
         ORDER BY ex.name ASC`
      )
      .all()
      .map((r) => ({ ...r, primaryMuscles: JSON.parse(r.primaryMuscles) }));
    res.json(rows);
  });

  app.get("/api/exercise-logs", (req, res) => {
    const { exerciseLibraryId, routineId } = req.query;
    if (exerciseLibraryId) {
      const rows = db
        .prepare("SELECT * FROM exercise_logs WHERE exerciseLibraryId = ? ORDER BY recordedAt DESC")
        .all(exerciseLibraryId);
      return res.json(rows);
    }
    if (routineId) {
      const rows = db
        .prepare("SELECT * FROM exercise_logs WHERE routineId = ? ORDER BY recordedAt DESC")
        .all(routineId);
      return res.json(rows);
    }
    const rows = db.prepare("SELECT * FROM exercise_logs ORDER BY recordedAt DESC LIMIT 500").all();
    res.json(rows);
  });

  app.post("/api/exercise-logs", (req, res) => {
    const { exerciseLibraryId, routineId, recordedAt, weight, sets, reps, notes } = req.body;
    if (!exerciseLibraryId || !sets || !reps) {
      return res.status(400).json({ error: "exerciseLibraryId_sets_reps_required" });
    }
    const ts = nowIso();
    const info = db
      .prepare(
        `INSERT INTO exercise_logs (exerciseLibraryId, routineId, recordedAt, weight, sets, reps, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(exerciseLibraryId, routineId ?? null, recordedAt || ts, weight ?? null, sets, reps, notes ?? null, ts);
    res.status(201).json(db.prepare("SELECT * FROM exercise_logs WHERE id = ?").get(info.lastInsertRowid));
  });

  app.put("/api/exercise-logs/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM exercise_logs WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const recordedAt = req.body.recordedAt ?? existing.recordedAt;
    const weight = req.body.weight ?? existing.weight;
    const sets = req.body.sets ?? existing.sets;
    const reps = req.body.reps ?? existing.reps;
    const notes = req.body.notes !== undefined ? req.body.notes : existing.notes;
    db.prepare(
      "UPDATE exercise_logs SET recordedAt = ?, weight = ?, sets = ?, reps = ?, notes = ? WHERE id = ?"
    ).run(recordedAt, weight, sets, reps, notes, req.params.id);
    res.json(db.prepare("SELECT * FROM exercise_logs WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/exercise-logs/:id", (req, res) => {
    db.prepare("DELETE FROM exercise_logs WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
