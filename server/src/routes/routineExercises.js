import { db, nowIso } from "../db/index.js";

export default function registerRoutineExercisesRoutes(app) {
  app.post("/api/routines/:routineId/exercises", (req, res) => {
    const routine = db.prepare("SELECT * FROM routines WHERE id = ?").get(req.params.routineId);
    if (!routine) return res.status(404).json({ error: "routine_not_found" });
    const { exerciseLibraryId, targetSets, targetReps, targetWeight, notes } = req.body;
    if (!exerciseLibraryId) return res.status(400).json({ error: "exerciseLibraryId_required" });
    const exercise = db.prepare("SELECT id FROM exercise_library WHERE id = ?").get(exerciseLibraryId);
    if (!exercise) return res.status(400).json({ error: "unknown_exercise" });
    const { maxOrder } = db
      .prepare("SELECT COALESCE(MAX(sortOrder), -1) as maxOrder FROM routine_exercises WHERE routineId = ?")
      .get(req.params.routineId);
    const ts = nowIso();
    const info = db
      .prepare(
        `INSERT INTO routine_exercises
          (routineId, exerciseLibraryId, targetSets, targetReps, targetWeight, notes, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.params.routineId,
        exerciseLibraryId,
        targetSets ?? null,
        targetReps ?? null,
        targetWeight ?? null,
        notes ?? null,
        maxOrder + 1,
        ts,
        ts
      );
    res.status(201).json(db.prepare("SELECT * FROM routine_exercises WHERE id = ?").get(info.lastInsertRowid));
  });

  app.put("/api/routine-exercises/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM routine_exercises WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const targetSets = req.body.targetSets ?? existing.targetSets;
    const targetReps = req.body.targetReps ?? existing.targetReps;
    const targetWeight = req.body.targetWeight ?? existing.targetWeight;
    const notes = req.body.notes !== undefined ? req.body.notes : existing.notes;
    const sortOrder = req.body.sortOrder ?? existing.sortOrder;
    db.prepare(
      `UPDATE routine_exercises
       SET targetSets = ?, targetReps = ?, targetWeight = ?, notes = ?, sortOrder = ?, updatedAt = ?
       WHERE id = ?`
    ).run(targetSets, targetReps, targetWeight, notes, sortOrder, nowIso(), req.params.id);
    res.json(db.prepare("SELECT * FROM routine_exercises WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/routine-exercises/:id", (req, res) => {
    db.prepare("DELETE FROM routine_exercises WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
