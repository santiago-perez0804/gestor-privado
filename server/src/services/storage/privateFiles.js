// Almacenamiento privado de archivos (fotos de progreso). Hoy: una carpeta fuera de todo lo que se
// sirve como estático, con nombres aleatorios. En la nube se reemplaza por un bucket privado con URLs
// firmadas manteniendo la misma interfaz: save / path / remove.
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const KEY = /^[0-9a-f-]{36}(\.thumb)?\.(jpg|jpeg|png|webp|heic)$/;

export function createPrivateFiles(dir) {
  mkdirSync(dir, { recursive: true });
  return {
    /** Guarda y devuelve la clave (nombre aleatorio, imposible de adivinar). */
    save(buf, ext, { thumbOf = null } = {}) {
      const key = thumbOf ? thumbOf.replace(/\.(jpg|png)$/, `.thumb.${ext}`) : `${randomUUID()}.${ext}`;
      writeFileSync(join(dir, key), buf);
      return key;
    },
    /** Ruta en disco de una clave válida (o null). Nunca sale de la carpeta. */
    path(key) {
      if (!KEY.test(String(key || ""))) return null;
      const p = join(dir, key);
      return existsSync(p) ? p : null;
    },
    remove(key) {
      const p = this.path(key);
      if (p) {
        try {
          unlinkSync(p);
        } catch {
          // en uso: queda huérfano, no es grave
        }
      }
    },
  };
}
