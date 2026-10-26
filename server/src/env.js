// Carga las variables de entorno (API keys, OAuth) desde un archivo .env, con el soporte que ya trae
// Node (process.loadEnvFile). Se importa primero en index.js para que todo lo demás ya las vea.
//
// - Desarrollo y app de escritorio sin empaquetar: .env en la raíz del proyecto.
// - App empaquetada: el main de Electron pasa ENV_FILE (carpeta de datos del usuario), así los
//   secretos no viajan dentro del instalador.
// Las variables que ya vienen del sistema tienen prioridad: loadEnvFile no las pisa.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = process.env.ENV_FILE || join(__dirname, "..", "..", ".env");

if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn(`[env] No se pudo leer ${envFile}: ${err.message}`);
  }
}
