// Copia diaria de la base en <data>/backups. Guarda las últimas KEEP copias.
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { db, dataDir } from "../db/index.js";
import { todayDateInputValue } from "../lib/billingMonth.js";

const KEEP = 14;
const backupsDir = join(dataDir, "backups");

export function backupNow() {
  mkdirSync(backupsDir, { recursive: true });
  const target = join(backupsDir, `fisico-${todayDateInputValue()}.db`);
  if (existsSync(target)) return null;
  // VACUUM INTO hace una copia consistente aunque la base esté en uso.
  db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  const daily = readdirSync(backupsDir)
    .filter((f) => /^fisico-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort();
  for (const old of daily.slice(0, Math.max(0, daily.length - KEEP))) unlinkSync(join(backupsDir, old));
  return target;
}

export function startDailyBackups() {
  const run = () => {
    try {
      const file = backupNow();
      if (file) console.log(`[backup] copia guardada en ${file}`);
    } catch (err) {
      console.error("[backup] no se pudo hacer la copia:", err.message);
    }
  };
  run();
  setInterval(run, 60 * 60 * 1000);
}
