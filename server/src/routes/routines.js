import { db, nowIso } from "../db/index.js";

function attachExercises(routine) {
  const exercises = db
    .prepare(
      `SELECT re.*, el.name as exerciseName, el.equipment as exerciseEquipment,
              el.primaryMuscles as exercisePrimaryMuscles
       FROM routine_exercises re
       JOIN exercise_library el ON el.id = re.exerciseLibraryId
       WHERE re.routineId = ?
       ORDER BY re.sortOrder ASC, re.createdAt ASC`
    )
    .all(routine.id)
    .map((r) => ({ ...r, exercisePrimaryMuscles: JSON.parse(r.exercisePrimaryMuscles) }));
  return { ...routine, exercises };
}

export default function registerRoutinesRoutes(app) {
  app.post("/api/plans/:planId/routines", (req, res) => {
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.planId);
    if (!plan) return res.status(404).json({ error: "plan_not_found" });
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ error: "name_required" });
    const { maxOrder } = db
      .prepare("SELECT COALESCE(MAX(sortOrder), -1) as maxOrder FROM routines WHERE planId = ?")
      .get(req.params.planId);
    const ts = nowIso();
    const info = db
      .prepare(
        "INSERT INTO routines (planId, name, description, icon, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(req.params.planId, name, description ?? null, icon ?? null, maxOrder + 1, ts, ts);
    res.status(201).json(db.prepare("SELECT * FROM routines WHERE id = ?").get(info.lastInsertRowid));
  });

  app.get("/api/routines/:id", (req, res) => {
    const routine = db.prepare("SELECT * FROM routines WHERE id = ?").get(req.params.id);
    if (!routine) return res.status(404).json({ error: "not_found" });
    res.json(attachExercises(routine));
  });

  app.put("/api/routines/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM routines WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const name = req.body.name ?? existing.name;
    const description = req.body.description ?? existing.description;
    const icon = req.body.icon !== undefined ? req.body.icon : existing.icon;
    const sortOrder = req.body.sortOrder ?? existing.sortOrder;
    db.prepare(
      "UPDATE routines SET name = ?, description = ?, icon = ?, sortOrder = ?, updatedAt = ? WHERE id = ?"
    ).run(name, description, icon, sortOrder, nowIso(), req.params.id);
    res.json(db.prepare("SELECT * FROM routines WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/routines/:id", (req, res) => {
    db.prepare("DELETE FROM routines WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
