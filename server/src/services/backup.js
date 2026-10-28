// Copia diaria de toda la base: un JSON comprimido con todas las tablas (se puede leer sin Postgres
// y sirve para restaurar). En la nube va al bucket privado "backups" de Supabase Storage; en
// desarrollo, a <data>/backups. Se guardan las últimas KEEP copias.
import { gzipSync } from "node:zlib";
import { db } from "../db/index.js";
import { storage } from "./storage/index.js";
import { todayDateInputValue } from "../lib/billingMonth.js";

const KEEP = 30;
const PREFIX = "gestor-";

/** Todas las tablas con todas sus filas. */
export async function snapshotAll() {
  const tables = (await db.prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename").all()).map((r) => r.tablename);
  const out = { format: "gestor-backup-v1", createdAt: new Date().toISOString(), tables: {} };
  for (const t of tables) {
    if (!/^[a-z_0-9]+$/.test(t)) continue;
    out.tables[t] = await db.prepare(`SELECT * FROM ${t}`).all();
  }
  return out;
}

/** Hace la copia del día (si no existe) y borra las viejas. Devuelve el nombre o null si ya estaba. */
export async function backupNow() {
  const bucket = storage("backups");
  const name = `${PREFIX}${todayDateInputValue()}.json.gz`;
  if (await bucket.exists(name)) return null;
  const data = gzipSync(Buffer.from(JSON.stringify(await snapshotAll())));
  await bucket.put(name, data, { contentType: "application/gzip" });
  const daily = (await bucket.list())
    .filter((f) => f.startsWith(PREFIX))
    .sort();
  for (const old of daily.slice(0, Math.max(0, daily.length - KEEP))) await bucket.remove(old);
  return name;
}

/** Desarrollo local: una copia al arrancar y después cada hora revisa si ya toca la del día. */
export function startDailyBackups() {
  const run = async () => {
    try {
      const file = await backupNow();
      if (file) console.log(`[backup] copia guardada: ${file}`);
    } catch (err) {
      console.error("[backup] no se pudo hacer la copia:", err.message);
    }
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref?.();
}
