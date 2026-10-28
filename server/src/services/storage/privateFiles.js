// Fotos de progreso: archivos privados con nombres aleatorios (imposibles de adivinar), en el bucket
// privado "photos" (Supabase) o en una carpeta fuera de todo lo que se sirve como estático (local).
// Se sirven solo por la API, con sesión y sin caché.
import { randomUUID } from "node:crypto";
import { storage, localStore } from "./index.js";

const KEY = /^[0-9a-f-]{36}(\.thumb)?\.(jpg|jpeg|png|webp|heic)$/;

/** @param {string | ReturnType<typeof storage>} [where] carpeta local (tests) o un almacenamiento; por defecto el bucket "photos". */
export function createPrivateFiles(where) {
  const store = typeof where === "string" ? localStore(where) : where ?? storage("photos");
  const valid = (key) => KEY.test(String(key || ""));
  return {
    /** Guarda y devuelve la clave. */
    async save(buf, ext, { thumbOf = null } = {}) {
      const key = thumbOf ? thumbOf.replace(/\.(jpg|png)$/, `.thumb.${ext}`) : `${randomUUID()}.${ext}`;
      await store.put(key, buf, { contentType: ext === "png" ? "image/png" : "image/jpeg" });
      return key;
    },
    /** ¿Existe el archivo de esa clave? (clave inválida = no). */
    async has(key) {
      return valid(key) && (await store.exists(key));
    },
    async get(key) {
      return valid(key) ? store.get(key) : null;
    },
    async remove(key) {
      if (!valid(key)) return;
      try {
        await store.remove(key);
      } catch {
        // queda huérfano, no es grave
      }
    },
    /** Manda el archivo (local) o redirige a una URL firmada de pocos minutos (nube). Nunca se cachea. */
    async serve(res, key, { contentType } = {}) {
      if (!valid(key)) return res.status(404).json({ error: "not_found" });
      return store.serve(res, key, { cacheControl: "private, no-store", contentType, expiresIn: 120 });
    },
  };
}
