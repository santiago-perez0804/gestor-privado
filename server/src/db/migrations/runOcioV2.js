// npm run migrate:ocio — corre la migración de Ocio (si hace falta) y muestra el resumen.
// Usa la misma base que el server (DATA_DIR o server/data). Abrir la base ya ejecuta la migración.
import "../../env.js";
import { ocioMigration } from "../index.js";
import { describeMigration } from "./ocioV2.js";

console.log(describeMigration(ocioMigration));
