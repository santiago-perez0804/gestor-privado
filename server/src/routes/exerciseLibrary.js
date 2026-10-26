import { db } from "../db/index.js";

function parseListRow(row) {
  return {
    id: row.id,
    name: row.name,
    force: row.force,
    level: row.level,
    mechanic: row.mechanic,
    equipment: row.equipment,
    primaryMuscles: JSON.parse(row.primaryMuscles),
    secondaryMuscles: JSON.parse(row.secondaryMuscles),
    category: row.category,
  };
}

export default function registerExerciseLibraryRoutes(app) {
  app.get("/api/exercise-library", (req, res) => {
    const { muscle, equipment, category, level, q } = req.query;
    const clauses = [];
    const params = [];
    if (muscle) {
      clauses.push("(primaryMuscles LIKE ? OR secondaryMuscles LIKE ?)");
      params.push(`%"${muscle}"%`, `%"${muscle}"%`);
    }
    if (equipment) {
      clauses.push("equipment = ?");
      params.push(equipment);
    }
    if (category) {
      clauses.push("category = ?");
      params.push(category);
    }
    if (level) {
      clauses.push("level = ?");
      params.push(level);
    }
    if (q) {
      clauses.push("name LIKE ?");
      params.push(`%${q}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.prepare(`SELECT * FROM exercise_library ${where} ORDER BY name ASC LIMIT 200`).all(...params);
    res.json(rows.map(parseListRow));
  });

  app.get("/api/exercise-library/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM exercise_library WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json({
      ...parseListRow(row),
      instructions: JSON.parse(row.instructions),
      images: JSON.parse(row.images ?? "[]"),
    });
  });
}
