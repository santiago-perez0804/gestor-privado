import { db, nowIso } from "../db/index.js";

const getDebt = (id) => db.prepare("SELECT * FROM debts WHERE id = ?").get(id);

// Queda saldada cuando lo pagado cubre el total; si se baja el pago vuelve a pendiente.
function settle(id) {
  const debt = getDebt(id);
  const settledAt = debt.paidAmount >= debt.amount ? debt.settledAt || nowIso() : null;
  db.prepare("UPDATE debts SET settledAt = ? WHERE id = ?").run(settledAt, id);
  return getDebt(id);
}

export default function registerDebtsRoutes(app) {
  app.get("/api/debts", (req, res) => {
    res.json(
      db.prepare("SELECT * FROM debts ORDER BY settledAt IS NOT NULL, dueDate IS NULL, dueDate ASC, createdAt DESC").all()
    );
  });

  app.post("/api/debts", (req, res) => {
    const { title, person, direction, amount, currency, dueDate, notes } = req.body;
    if (!title || !(Number(amount) > 0)) return res.status(400).json({ error: "title_amount_required" });
    const ts = nowIso();
    const info = db
      .prepare(
        `INSERT INTO debts (title, person, direction, amount, paidAmount, currency, dueDate, notes, settledAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, ?)`
      )
      .run(
        title,
        person || null,
        direction === "me_deben" ? "me_deben" : "debo",
        Number(amount),
        currency === "USD" ? "USD" : "ARS",
        dueDate || null,
        notes || null,
        ts,
        ts
      );
    res.status(201).json(getDebt(info.lastInsertRowid));
  });

  app.put("/api/debts/:id", (req, res) => {
    const existing = getDebt(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const b = req.body;
    const merged = {
      title: b.title ?? existing.title,
      person: b.person !== undefined ? b.person || null : existing.person,
      direction: b.direction ? (b.direction === "me_deben" ? "me_deben" : "debo") : existing.direction,
      amount: b.amount !== undefined ? Number(b.amount) : existing.amount,
      paidAmount: b.paidAmount !== undefined ? Math.max(0, Number(b.paidAmount)) : existing.paidAmount,
      currency: b.currency ? (b.currency === "USD" ? "USD" : "ARS") : existing.currency,
      dueDate: b.dueDate !== undefined ? b.dueDate || null : existing.dueDate,
      notes: b.notes !== undefined ? b.notes || null : existing.notes,
    };
    db.prepare(
      "UPDATE debts SET title=?, person=?, direction=?, amount=?, paidAmount=?, currency=?, dueDate=?, notes=?, updatedAt=? WHERE id=?"
    ).run(
      merged.title,
      merged.person,
      merged.direction,
      merged.amount,
      merged.paidAmount,
      merged.currency,
      merged.dueDate,
      merged.notes,
      nowIso(),
      req.params.id
    );
    res.json(settle(req.params.id));
  });

  // Pago parcial o total: suma al acumulado (sin pasarse del total).
  app.post("/api/debts/:id/payments", (req, res) => {
    const existing = getDebt(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const amount = Number(req.body.amount);
    if (!(amount > 0)) return res.status(400).json({ error: "amount_required" });
    const paid = Math.min(existing.amount, existing.paidAmount + amount);
    db.prepare("UPDATE debts SET paidAmount = ?, updatedAt = ? WHERE id = ?").run(paid, nowIso(), req.params.id);
    res.json(settle(req.params.id));
  });

  app.delete("/api/debts/:id", (req, res) => {
    db.prepare("DELETE FROM debts WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
