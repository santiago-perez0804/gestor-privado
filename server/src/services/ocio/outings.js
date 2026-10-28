// Salidas ↔ gastos: vincular, sugerir candidatos y resumir lo gastado. No toca la tabla de gastos:
// el vínculo vive en outing_expenses (y se borra solo si se borra el gasto o la salida).

const pad = (n) => String(n).padStart(2, "0");
const DAY = 86_400_000;
const toDate = (s) => new Date(`${s}T00:00:00`);
const shift = (s, days) => {
  const d = toDate(s);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const STOP = new Set(["para", "con", "una", "unos", "unas", "salida", "plan", "cumple", "cumpleanos", "fiesta", "juntada", "noche", "tarde", "casa"]);

/** Palabras "propias" de un título (≥4 letras, no genéricas), recortadas a 5 letras para tolerar variantes ("oktoberfest" ~ "oktober"). */
export function keyTokens(title) {
  return [...new Set(norm(title).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !STOP.has(w)).map((w) => w.slice(0, 5)))];
}

const textMatches = (tokens, text) => {
  const t = norm(text);
  return tokens.some((k) => t.includes(k));
};

const EXPENSE_FIELDS = "e.id, e.title, e.description, e.amount, e.date, e.category, e.paymentMethod, e.installments";

export function createOutings(db) {
  const getOuting = db.prepare("SELECT * FROM outings WHERE id = ? AND deletedAt IS NULL");

  /** Salidas (no borradas) con lo gastado en cada una y cuántos gastos tiene vinculados. */
  async function list({ from, to, status } = {}) {
    const clauses = ["o.deletedAt IS NULL"];
    const params = [];
    if (from) (clauses.push("o.date >= ?"), params.push(from));
    if (to) (clauses.push("o.date <= ?"), params.push(to));
    if (status) (clauses.push("o.status = ?"), params.push(status));
    return await db
      .prepare(
        `SELECT o.*, COALESCE(SUM(e.amount), 0) AS spent, COUNT(e.id) AS linkedCount
         FROM outings o LEFT JOIN outing_expenses oe ON oe.outingId = o.id LEFT JOIN expenses e ON e.id = oe.expenseId
         WHERE ${clauses.join(" AND ")} GROUP BY o.id ORDER BY o.date, o.startTime`
      )
      .all(...params);
  }

  async function linked(outingId) {
    return await db.prepare(`SELECT ${EXPENSE_FIELDS} FROM outing_expenses oe JOIN expenses e ON e.id = oe.expenseId WHERE oe.outingId = ? ORDER BY e.date, e.id`).all(outingId);
  }

  /**
   * Gastos que podrían ir con la salida: los del día ±1 y los que la mencionan (±30 días).
   * Cada uno trae `reason` ("fecha" / "texto") y, si ya está vinculado a otra salida, `linkedTo`.
   */
  async function candidates(outingId) {
    const o = await getOuting.get(outingId);
    if (!o) return null;
    const already = new Set((await linked(outingId)).map((e) => e.id));
    const tokens = keyTokens(o.title);
    const near = await db.prepare(`SELECT ${EXPENSE_FIELDS} FROM expenses e WHERE e.date BETWEEN ? AND ? ORDER BY e.date, e.id`).all(shift(o.date, -1), shift(o.date, 1));
    const wide = tokens.length ? await db.prepare(`SELECT ${EXPENSE_FIELDS} FROM expenses e WHERE e.date BETWEEN ? AND ?`).all(shift(o.date, -30), shift(o.date, 30)) : [];
    const out = new Map();
    for (const e of near) if (!already.has(e.id)) out.set(e.id, { ...e, reason: textMatches(tokens, `${e.title} ${e.description}`) ? "texto" : "fecha" });
    for (const e of wide) if (!already.has(e.id) && !out.has(e.id) && textMatches(tokens, `${e.title} ${e.description}`)) out.set(e.id, { ...e, reason: "texto" });
    const otherLinks = await db.prepare("SELECT oe.expenseId, o.title FROM outing_expenses oe JOIN outings o ON o.id = oe.outingId WHERE oe.outingId != ?").all(outingId);
    const linkedTo = new Map(otherLinks.map((l) => [l.expenseId, l.title]));
    const distance = (e) => Math.abs(toDate(e.date) - toDate(o.date)) / DAY;
    return [...out.values()]
      .map((e) => (linkedTo.has(e.id) ? { ...e, linkedTo: linkedTo.get(e.id) } : e))
      .sort((a, b) => (a.reason === b.reason ? 0 : a.reason === "texto" ? -1 : 1) || distance(a) - distance(b));
  }

  async function link(outingId, expenseId) {
    if (!await getOuting.get(outingId)) throw Object.assign(new Error("not_found"), { status: 404 });
    if (!await db.prepare("SELECT id FROM expenses WHERE id = ?").get(expenseId)) throw Object.assign(new Error("expense_not_found"), { status: 404 });
    await db.prepare("INSERT OR IGNORE INTO outing_expenses (outingId, expenseId, createdAt) VALUES (?, ?, ?)").run(outingId, expenseId, new Date().toISOString());
    return await linked(outingId);
  }

  async function unlink(outingId, expenseId) {
    await db.prepare("DELETE FROM outing_expenses WHERE outingId = ? AND expenseId = ?").run(outingId, expenseId);
    return await linked(outingId);
  }

  /** Para un gasto recién cargado: ¿va con alguna salida? (mismo día ±1, o la menciona dentro de ±30 días). */
  async function suggestForExpense({ date, title = "", description = "", expenseId = null }) {
    if (!date) return [];
    const text = `${title} ${description}`;
    const rows = await db
      .prepare("SELECT * FROM outings WHERE deletedAt IS NULL AND status != 'not_attended' AND date BETWEEN ? AND ?")
      .all(shift(date, -30), shift(date, 30));
    const isLinked = expenseId ? new Set((await db.prepare("SELECT outingId FROM outing_expenses WHERE expenseId = ?").all(expenseId)).map((r) => r.outingId)) : new Set();
    return rows
      .map((o) => {
        const days = Math.abs(toDate(o.date) - toDate(date)) / DAY;
        const byText = textMatches(keyTokens(o.title), text);
        return { outing: o, days, reason: byText ? "texto" : days <= 1 ? "fecha" : null };
      })
      .filter((x) => x.reason && !isLinked.has(x.outing.id))
      .sort((a, b) => (a.reason === b.reason ? 0 : a.reason === "texto" ? -1 : 1) || a.days - b.days)
      .slice(0, 3)
      .map((x) => ({ ...x.outing, reason: x.reason }));
  }

  /**
   * Números de la pantalla Salidas para un mes (YYYY-MM): cuántas en el año y en el mes, cuánto
   * se gastó en las del mes (cada gasto una vez), qué hacés más, cuáles faltan confirmar y las próximas.
   */
  async function summary({ month, today }) {
    const year = month.slice(0, 4);
    const all = await list();
    const ofYear = all.filter((o) => o.date.startsWith(year) && o.status !== "not_attended");
    const ofMonth = all.filter((o) => o.date.startsWith(month) && o.status !== "not_attended");
    const monthSpent =
      (await db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE id IN (
             SELECT oe.expenseId FROM outing_expenses oe JOIN outings o ON o.id = oe.outingId
             WHERE o.deletedAt IS NULL AND o.date LIKE ?)`
        )
        .get(`${month}%`)).total;
    const byCategory = new Map();
    for (const o of ofYear) if (o.category) byCategory.set(o.category, (byCategory.get(o.category) || 0) + 1);
    const [topId, topCount] = [...byCategory].sort((a, b) => b[1] - a[1])[0] || [];
    const planned = (o) => o.status === "tentative" || o.status === "confirmed";
    return {
      year: Number(year),
      yearCount: ofYear.length,
      monthCount: ofMonth.length,
      monthSpent,
      topCategory: topId ? { id: topId, count: topCount, of: ofYear.length } : null,
      unconfirmed: all.filter((o) => planned(o) && o.date < today),
      upcoming: all.filter((o) => planned(o) && o.date >= today).slice(0, 4),
    };
  }

  return { list, linked, candidates, link, unlink, suggestForExpense, summary };
}
