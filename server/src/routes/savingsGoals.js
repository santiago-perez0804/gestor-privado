import { db, nowIso } from "../db/index.js";

const savedFor = db.prepare("SELECT COALESCE(SUM(amount), 0) AS saved FROM savings_contributions WHERE goalId = ?");
const contributionsFor = db.prepare("SELECT * FROM savings_contributions WHERE goalId = ? ORDER BY date DESC, id DESC LIMIT 20");

async function withProgress(goal) {
  return { ...goal, saved: (await savedFor.get(goal.id)).saved, contributions: await contributionsFor.all(goal.id) };
}

async function getGoal(id) {
  const row = await db.prepare("SELECT * FROM savings_goals WHERE id = ?").get(id);
  return row ? await withProgress(row) : null;
}

export default function registerSavingsGoalsRoutes(app) {
  app.get("/api/savings-goals", async (req, res) => {
    const rows = await db.prepare("SELECT * FROM savings_goals ORDER BY archived ASC, createdAt ASC").all();
    res.json(rows.map(withProgress));
  });

  app.post("/api/savings-goals", async (req, res) => {
    const { title, targetAmount, currency, deadline, icon } = req.body;
    if (!title || !targetAmount) return res.status(400).json({ error: "title_targetAmount_required" });
    const ts = nowIso();
    const info = await db
      .prepare(
        `INSERT INTO savings_goals (title, targetAmount, currency, deadline, icon, archived, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(title, targetAmount, currency ?? "ARS", deadline || null, icon ?? null, ts, ts);
    res.status(201).json(await getGoal(info.lastInsertRowid));
  });

  app.put("/api/savings-goals/:id", async (req, res) => {
    const existing = await db.prepare("SELECT * FROM savings_goals WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const merged = {
      title: req.body.title ?? existing.title,
      targetAmount: req.body.targetAmount ?? existing.targetAmount,
      currency: req.body.currency ?? existing.currency,
      deadline: req.body.deadline !== undefined ? req.body.deadline || null : existing.deadline,
      icon: req.body.icon !== undefined ? req.body.icon : existing.icon,
      archived: req.body.archived !== undefined ? (req.body.archived ? 1 : 0) : existing.archived,
    };
    await db.prepare(
      `UPDATE savings_goals SET title=?, targetAmount=?, currency=?, deadline=?, icon=?, archived=?, updatedAt=? WHERE id=?`
    ).run(merged.title, merged.targetAmount, merged.currency, merged.deadline, merged.icon, merged.archived, nowIso(), req.params.id);
    res.json(await getGoal(req.params.id));
  });

  app.delete("/api/savings-goals/:id", async (req, res) => {
    await db.prepare("DELETE FROM savings_goals WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });

  // Aportes: monto positivo = depósito, negativo = retiro.
  app.post("/api/savings-goals/:id/contributions", async (req, res) => {
    const goal = await db.prepare("SELECT id FROM savings_goals WHERE id = ?").get(req.params.id);
    if (!goal) return res.status(404).json({ error: "not_found" });
    const { amount, date, note } = req.body;
    if (!amount || !date) return res.status(400).json({ error: "amount_date_required" });
    await db.prepare("INSERT INTO savings_contributions (goalId, amount, date, note, createdAt) VALUES (?, ?, ?, ?, ?)").run(
      req.params.id,
      amount,
      date,
      note ?? null,
      nowIso()
    );
    res.status(201).json(await getGoal(req.params.id));
  });

  app.delete("/api/savings-contributions/:id", async (req, res) => {
    const row = await db.prepare("SELECT goalId FROM savings_contributions WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "not_found" });
    await db.prepare("DELETE FROM savings_contributions WHERE id = ?").run(req.params.id);
    res.json(await getGoal(row.goalId));
  });
}
