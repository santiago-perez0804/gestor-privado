import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { testDb } from "./helpers/pgdb.js";
import { sharedSchema } from "../src/db/schema/shared.js";
import { fisicoSchema } from "../src/db/schema/fisico.js";
import { gastosSchema } from "../src/db/schema/gastos.js";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { proyectosSchema } from "../src/db/schema/proyectos.js";
import { runMigrations } from "../src/db/migrate.js";
import { migrateOcioV2 } from "../src/db/migrations/ocioV2.js";
import { migrateFisicoV2 } from "../src/db/migrations/fisicoV2.js";
import { transferSqliteToPg } from "../src/db/transfer.js";

/** Una base SQLite como la de la PC, con datos en los 4 módulos. */
function sqliteWithData(t) {
  const dir = mkdtempSync(join(tmpdir(), "mudanza-"));
  const path = join(dir, "fisico.db");
  const db = new DatabaseSync(path);
  for (const s of [sharedSchema, fisicoSchema, gastosSchema, ocioSchema, proyectosSchema]) db.exec(s);
  runMigrations(db);
  migrateOcioV2(db);
  migrateFisicoV2(db);
  db.exec(`
    INSERT INTO weights (id, weight, recordedAt, createdAt, note) VALUES (7, 91.35, '2026-10-01T08:00', 'x', 'después de entrenar'), (9, 90.8, '2026-10-08T08:00', 'x', NULL);
    INSERT INTO expenses (id, title, amount, currency, originalAmount, exchangeRate, installments, date, createdAt, updatedAt, category, paymentMethod)
      VALUES (40, 'Netflix', 12345.67, 'USD', 9.99, 1235.75, 1, '2026-10-10', 'x', 'x', 'suscripciones', 'credito');
    INSERT INTO works (id, type, title, creators, genres, metadata, createdAt, updatedAt) VALUES (3, 'book', 'Ñandú: un "título" raro', '["Autora"]', '[]', '{}', 'x', 'x');
    INSERT INTO library_entries (id, workId, status, rating, createdAt, updatedAt) VALUES (5, 3, 'done', 4.5, 'x', 'x');
    INSERT INTO workout_sessions (id, title, startedAt, status, localDate, createdAt, updatedAt) VALUES ('ses-uuid-1', 'Pull A', '2026-10-27T21:00:00Z', 'done', '2026-10-27', 'x', 'x');
    INSERT INTO set_logs (id, sessionId, exerciseId, exerciseOrder, setOrder, type, weightKg, reps, completedAt, updatedAt) VALUES ('set-1', 'ses-uuid-1', 1, 0, 0, 'working', 32.5, 8, 'x', 'x');
    INSERT INTO settings (key, value) VALUES ('billing_cutoff_day', '22');
  `);
  db.close();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return path;
}

test("mudanza: copia todo igual (ids, decimales, textos con comillas y ñ), sigue numerando y verifica", async (t) => {
  const path = sqliteWithData(t);
  const db = await testDb();
  const report = await transferSqliteToPg({ sqlitePath: path, db });
  assert.deepEqual(report.problems, [], "verificación sin diferencias");
  assert.equal((await db.prepare("SELECT note FROM weights WHERE id = 7").get()).note, "después de entrenar");
  assert.equal((await db.prepare("SELECT amount FROM expenses WHERE id = 40").get()).amount, 12345.67);
  assert.equal((await db.prepare("SELECT title FROM works WHERE id = 3").get()).title, 'Ñandú: un "título" raro');
  assert.equal((await db.prepare("SELECT rating FROM library_entries WHERE id = 5").get()).rating, 4.5);
  assert.equal((await db.prepare("SELECT weightKg FROM set_logs WHERE id = 'set-1'").get()).weightKg, 32.5);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM exercises").get()).n, 75, "biblioteca de la PC (fuerza + cardio)");
  // Los ids nuevos siguen después de los copiados.
  const { lastInsertRowid } = await db.prepare("INSERT INTO weights (weight, recordedAt, createdAt) VALUES (90, 'y', 'y')").run();
  assert.equal(lastInsertRowid, 10);
});

test("mudanza: no pisa un destino con datos salvo que se fuerce", async (t) => {
  const path = sqliteWithData(t);
  const db = await testDb();
  await db.prepare("INSERT INTO weights (weight, recordedAt, createdAt) VALUES (88, 'z', 'z')").run();
  await assert.rejects(transferSqliteToPg({ sqlitePath: path, db }), { code: "TARGET_NOT_EMPTY" });
  const forced = await transferSqliteToPg({ sqlitePath: path, db, force: true });
  assert.deepEqual(forced.problems, []);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM weights").get()).n, 2, "quedó exactamente lo de la PC");
});
