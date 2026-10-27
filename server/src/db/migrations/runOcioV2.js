// npm run migrate:ocio — corre la migración de Ocio (si hace falta) y muestra el resumen.
// Usa la misma base que el server (DATA_DIR o server/data). Abrir la base ya ejecuta la migración
// (y, si migró algo, ya lo anunció), así que acá solo se avisa cuando no había nada que hacer.
import "../../env.js";
import { ocioMigration } from "../index.js";
import { describeMigration } from "./ocioV2.js";

if (!ocioMigration.ran) console.log(describeMigration(ocioMigration));
