import { db, nowIso } from "../db/index.js";
import { todayDateInputValue } from "../lib/billingMonth.js";

const TYPES = ["efectivo", "banco", "billetera", "inversion", "otro"];

const snapshot = db.prepare(
  "INSERT INTO account_snapshots (accountId, date, balance) VALUES (?, ?, ?) ON CONFLICT(accountId, date) DO UPDATE SET balance = excluded.balance"
);

export default function registerAccountsRoutes(app) {
  app.get("/api/accounts", (req, res) => {
    res.json(db.prepare("SELECT * FROM accounts ORDER BY archived ASC, createdAt ASC").all());
  });

  // Historial de saldos de todas las cuentas (para la evolución del patrimonio).
  app.get("/api/account-snapshots", (req, res) => {
    res.json(db.prepare("SELECT * FROM account_snapshots ORDER BY date ASC").all());
  });

  app.post("/api/accounts", (req, res) => {
    const { name, type, currency, balance } = req.body;
    if (!name) return res.status(400).json({ error: "name_required" });
    const ts = nowIso();
    const info = db
      .prepare("INSERT INTO accounts (name, type, currency, balance, archived, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, ?, ?)")
      .run(name, TYPES.includes(type) ? type : "otro", currency === "USD" ? "USD" : "ARS", Number(balance) || 0, ts, ts);
    snapshot.run(info.lastInsertRowid, todayDateInputValue(), Number(balance) || 0);
    res.status(201).json(db.prepare("SELECT * FROM accounts WHERE id = ?").get(info.lastInsertRowid));
  });

  app.put("/api/accounts/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const m = {
      name: req.body.name ?? existing.name,
      type: TYPES.includes(req.body.type) ? req.body.type : existing.type,
      currency: req.body.currency ?? existing.currency,
      balance: req.body.balance !== undefined ? Number(req.body.balance) || 0 : existing.balance,
      archived: req.body.archived !== undefined ? (req.body.archived ? 1 : 0) : existing.archived,
    };
    db.prepare("UPDATE accounts SET name=?, type=?, currency=?, balance=?, archived=?, updatedAt=? WHERE id=?").run(
      m.name,
      m.type,
      m.currency,
      m.balance,
      m.archived,
      nowIso(),
      req.params.id
    );
    if (m.balance !== existing.balance) snapshot.run(req.params.id, todayDateInputValue(), m.balance);
    res.json(db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/accounts/:id", (req, res) => {
    db.prepare("DELETE FROM accounts WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
