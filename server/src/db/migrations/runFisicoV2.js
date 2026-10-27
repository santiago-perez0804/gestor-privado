// npm run migrate:fisico — corre la migración de Físico (si hace falta) y muestra el resumen.
// Usa la misma base que el server (DATA_DIR o server/data). Abrir la base ya ejecuta la migración
// (y, si migró algo, ya lo anunció), así que acá solo se avisa cuando no había nada que hacer.
import "../../env.js";
import { fisicoMigration } from "../index.js";
import { describeFisicoMigration } from "./fisicoV2.js";

if (!fisicoMigration.ran) console.log(describeFisicoMigration(fisicoMigration));
