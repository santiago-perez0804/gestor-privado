import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { gastosSchema } from "../src/db/schema/gastos.js";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { migrateOcioV2, describeMigration } from "../src/db/migrations/ocioV2.js";

const OLD_OUTINGS = `CREATE TABLE outings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT, plannedDate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planeado' CHECK(status IN ('planeado','hecho','cancelado')),
  location TEXT, notes TEXT, icon TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
  CREATE INDEX idx_outings_plannedDate ON outings(plannedDate);
  CREATE INDEX idx_outings_status ON outings(status);`;

/** Base con la forma anterior al rediseño y datos como los reales. */
function legacyDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(gastosSchema);
  db.exec(OLD_OUTINGS);
  db.exec(ocioSchema); // crea media_items y las tablas nuevas; `outings` ya existe con la forma vieja
  const ts = "2026-09-29T14:53:44.759Z";
  const media = db.prepare(
    "INSERT INTO media_items (id, type, title, status, rating, notes, progressCurrent, progressTotal, progressLabel, icon, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
  );
  media.run(3, "videojuego", "Disco Elysium", "en_progreso", null, null, 18, null, "hs", null, ts, ts);
  media.run(4, "libro", "Dune", "pendiente", null, null, null, null, "pág.", null, ts, ts);
  media.run(7, "libro", "Un mago de Terramar", "completado", 3, "lento en la mitad", null, null, "pág.", "BookOpen", ts, ts);
  media.run(12, "pelicula", "Perfect Days", "abandonado", null, null, 40, 124, "min", null, ts, ts);
  const outing = db.prepare("INSERT INTO outings (id, title, category, plannedDate, status, location, notes, icon, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)");
  outing.run(3, "Oktoberfest", "Fiesta", "2026-10-10", "planeado", "Villa General Belgrano", null, "PartyPopper", ts, ts);
  outing.run(4, "Aniversario Kiara", null, "2026-10-14", "planeado", null, null, "PartyPopper", ts, ts);
  outing.run(5, "La Fabrica Halloween?", null, "2026-10-31", "planeado", null, "Sin confirmar", "Music", ts, ts);
  outing.run(6, "Cumple Fede", "Cumpleaños", "2026-09-01", "hecho", null, null, null, ts, ts);
  outing.run(7, "Recital", null, "2026-08-01", "cancelado", null, "llovió", null, ts, ts);
  return db;
}

test("migra obras y salidas sin perder datos", () => {
  const db = legacyDb();
  const s = migrateOcioV2(db, { now: new Date("2026-10-26T12:00:00Z") });
  assert.equal(s.ran, true);
  assert.equal(s.works, 4);
  assert.equal(s.outings, 5);
  assert.match(describeMigration(s), /4 obras/);

  const rows = db
    .prepare("SELECT w.type, w.title, w.metadata, e.status, e.rating, e.notes, e.legacyMediaItemId FROM works w JOIN library_entries e ON e.workId = w.id ORDER BY e.legacyMediaItemId")
    .all();
  assert.deepEqual(
    rows.map((r) => [r.legacyMediaItemId, r.type, r.status, r.rating]),
    [
      [3, "game", "in_progress", null],
      [4, "book", "want", null],
      [7, "book", "done", 3],
      [12, "movie", "dropped", null],
    ]
  );
  assert.equal(rows[2].notes, "lento en la mitad");
  assert.deepEqual(JSON.parse(rows[2].metadata), { legacyIcon: "BookOpen" });

  // "Quiero" no tiene pasadas; lo empezado, una con su progreso.
  const passes = db.prepare("SELECT e.legacyMediaItemId AS legacy, p.status, p.progress FROM passes p JOIN library_entries e ON e.id = p.entryId ORDER BY legacy").all();
  assert.deepEqual(
    passes.map((p) => [p.legacy, p.status, JSON.parse(p.progress)]),
    [
      [3, "in_progress", { unit: "hours", current: 18 }],
      [7, "done", {}],
      [12, "dropped", { unit: "minute", current: 40, total: 124 }],
    ]
  );

  const outings = db.prepare("SELECT id, title, category, date, status, place, notes FROM outings ORDER BY id").all();
  assert.deepEqual(
    outings.map((o) => [o.id, o.category, o.date, o.status]),
    [
      [3, "fiesta", "2026-10-10", "confirmed"],
      [4, "celebracion", "2026-10-14", "confirmed"],
      [5, "musica", "2026-10-31", "tentative"],
      [6, "celebracion", "2026-09-01", "attended"],
      [7, "musica", "2026-08-01", "not_attended"], // sin categoría: se deduce del título ("Recital")
    ]
  );
  assert.equal(outings[0].place, "Villa General Belgrano");
  assert.equal(outings[4].notes, "llovió · Cancelada");
  // Lo viejo queda como respaldo.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outings_legacy").get().n, 5);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM media_items").get().n, 4);
});

test("es idempotente: correrla de nuevo no duplica nada", () => {
  const db = legacyDb();
  migrateOcioV2(db);
  const again = migrateOcioV2(db);
  assert.equal(again.ran, false);
  assert.match(describeMigration(again), /nada para migrar/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM works").get().n, 4);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outings").get().n, 5);
  // Una obra vieja agregada después (p. ej. desde una versión anterior) se migra sola.
  db.prepare("INSERT INTO media_items (type, title, status, createdAt, updatedAt) VALUES ('serie', 'Ruptura', 'en_progreso', 'x', 'x')").run();
  const third = migrateOcioV2(db);
  assert.equal(third.works, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM works").get().n, 5);
});

test("en una base nueva no hace nada y deja listo el vínculo con gastos", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(gastosSchema);
  db.exec(ocioSchema);
  const s = migrateOcioV2(db);
  assert.equal(s.ran, false);
  const ts = new Date().toISOString();
  const outingId = db.prepare("INSERT INTO outings (title, date, createdAt, updatedAt) VALUES ('x', '2026-10-31', ?, ?)").run(ts, ts).lastInsertRowid;
  const expenseId = db
    .prepare("INSERT INTO expenses (title, amount, originalAmount, date, createdAt, updatedAt) VALUES ('Entrada', 10000, 10000, '2026-10-31', ?, ?)")
    .run(ts, ts).lastInsertRowid;
  db.prepare("INSERT INTO outing_expenses (outingId, expenseId, createdAt) VALUES (?, ?, ?)").run(outingId, expenseId, ts);
  // Borrar el gasto borra el vínculo (no deja huérfanos).
  db.prepare("DELETE FROM expenses WHERE id = ?").run(expenseId);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outing_expenses").get().n, 0);
});
