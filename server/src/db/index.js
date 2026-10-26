import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { sharedSchema } from "./schema/shared.js";
import { fisicoSchema } from "./schema/fisico.js";
import { gastosSchema } from "./schema/gastos.js";
import { ocioSchema } from "./schema/ocio.js";
import { proyectosSchema } from "./schema/proyectos.js";
import { runMigrations } from "./migrate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const dataDir = process.env.DATA_DIR || join(__dirname, "..", "..", "data");
export const photosDir = join(dataDir, "photos");
export const certificatesDir = join(dataDir, "certificates");
mkdirSync(dataDir, { recursive: true });
mkdirSync(photosDir, { recursive: true });
mkdirSync(certificatesDir, { recursive: true });

export const db = new DatabaseSync(join(dataDir, "fisico.db"));
db.exec("PRAGMA foreign_keys = ON");

db.exec(sharedSchema);
db.exec(fisicoSchema);
db.exec(gastosSchema);
db.exec(ocioSchema);
db.exec(proyectosSchema);
runMigrations(db);

export function nowIso() {
  return new Date().toISOString();
}
