// Archivos de la app (fotos de progreso, portadas, atril, certificados, importaciones y backups).
// - En la nube (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY): Supabase Storage, buckets privados.
// - En desarrollo / tests: carpetas locales dentro de <data>.
// La misma interfaz en los dos casos: put / get / exists / list / remove / serve.
//
// Servir un archivo (`serve`): en local se manda el archivo; en la nube se redirige a una URL firmada
// de vida corta (el archivo no pasa por la función de Vercel, que tiene un límite de 4,5 MB). La
// redirección se puede cachear un rato en el navegador para no pedir otra firma en cada vista.
import { join, basename } from "node:path";
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dataDir, privatePhotosDir, coversDir, artworksDir, certificatesDir, importsDir } from "../../db/index.js";

export const BUCKETS = ["photos", "covers", "artworks", "certificates", "imports", "backups"];

/** Nombres de archivo que aceptamos (sin carpetas ni "..": nada de salir del bucket). */
export const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;
const assertKey = (key) => {
  if (!SAFE_KEY.test(String(key || "")) || String(key).includes("..")) throw Object.assign(new Error("invalid_file_key"), { status: 400 });
  return String(key);
};

const LOCAL_DIRS = {
  photos: privatePhotosDir,
  covers: coversDir,
  artworks: artworksDir,
  certificates: certificatesDir,
  imports: importsDir,
  backups: join(dataDir, "backups"),
};

const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", pdf: "application/pdf", gz: "application/gzip", json: "application/json" };
export const mimeOf = (key) => MIME[String(key).split(".").pop().toLowerCase()] ?? "application/octet-stream";

export const cloudStorage = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Almacenamiento en una carpeta local (desarrollo, tests, app de escritorio). */
export function localStore(dir) {
  const path = (key) => join(dir, assertKey(key));
  const ensure = () => mkdirSync(dir, { recursive: true });
  return {
    kind: "local",
    async put(key, buf) {
      ensure();
      writeFileSync(path(key), buf);
      return key;
    },
    async get(key) {
      const p = path(key);
      return existsSync(p) ? readFileSync(p) : null;
    },
    async exists(key) {
      return existsSync(path(key));
    },
    async list() {
      return existsSync(dir) ? readdirSync(dir) : [];
    },
    async remove(key) {
      try {
        unlinkSync(path(key));
      } catch {
        // ya no estaba: nada que hacer
      }
    },
    async serve(res, key, { cacheControl = "private, no-store", contentType } = {}) {
      const p = path(key);
      if (!existsSync(p)) return res.status(404).json({ error: "not_found" });
      res.set({ "Cache-Control": cacheControl, "Content-Type": contentType || mimeOf(key), "X-Content-Type-Options": "nosniff" });
      res.sendFile(p);
    },
    /** Ruta en disco (para leer con node:sqlite, p. ej. KOReader). */
    async localFile(key) {
      const p = path(key);
      return existsSync(p) ? p : null;
    },
  };
}

function supabaseDriver(bucket) {
  const base = `${process.env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = (extra = {}) => ({ Authorization: `Bearer ${key}`, apikey: key, ...extra });
  const obj = (k) => `${base}/object/${bucket}/${encodeURIComponent(assertKey(k))}`;
  const fail = async (r, what) => {
    const text = await r.text().catch(() => "");
    throw new Error(`storage ${what} ${bucket}: ${r.status} ${text.slice(0, 200)}`);
  };
  return {
    kind: "supabase",
    async put(k, buf, { contentType } = {}) {
      const r = await fetch(obj(k), { method: "POST", headers: headers({ "Content-Type": contentType || mimeOf(k), "x-upsert": "true", "Cache-Control": "max-age=31536000" }), body: buf });
      if (!r.ok) await fail(r, "put");
      return k;
    },
    async get(k) {
      const r = await fetch(obj(k), { headers: headers() });
      if (r.status === 404 || r.status === 400) return null;
      if (!r.ok) await fail(r, "get");
      return Buffer.from(await r.arrayBuffer());
    },
    async exists(k) {
      const r = await fetch(`${base}/object/info/${bucket}/${encodeURIComponent(assertKey(k))}`, { headers: headers() });
      if (r.ok) return true;
      if (r.status === 404 || r.status === 400) return false;
      await fail(r, "exists");
    },
    async list() {
      const names = [];
      for (let offset = 0; ; offset += 1000) {
        const r = await fetch(`${base}/object/list/${bucket}`, { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ prefix: "", limit: 1000, offset, sortBy: { column: "name", order: "asc" } }) });
        if (!r.ok) await fail(r, "list");
        const page = await r.json();
        names.push(...page.filter((f) => f.id).map((f) => f.name));
        if (page.length < 1000) return names;
      }
    },
    async remove(k) {
      const r = await fetch(`${base}/object/${bucket}`, { method: "DELETE", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ prefixes: [assertKey(k)] }) });
      if (!r.ok && r.status !== 404) await fail(r, "remove");
    },
    /** URL firmada de vida corta (segundos). */
    async signedUrl(k, expiresIn = 600) {
      const r = await fetch(`${base}/object/sign/${bucket}/${encodeURIComponent(assertKey(k))}`, { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ expiresIn }) });
      if (r.status === 404 || r.status === 400) return null;
      if (!r.ok) await fail(r, "sign");
      const { signedURL } = await r.json();
      return `${base}${signedURL}`;
    },
    async serve(res, k, { cacheControl = "private, no-store", expiresIn = 600 } = {}) {
      const url = await this.signedUrl(k, expiresIn);
      if (!url) return res.status(404).json({ error: "not_found" });
      // La redirección se cachea como mucho hasta un minuto antes de que venza la firma.
      const maxAge = /no-store/.test(cacheControl) ? 0 : Math.max(0, Math.min(expiresIn - 60, Number(cacheControl.match(/max-age=(\d+)/)?.[1] ?? 0)));
      res.set({ "Cache-Control": maxAge ? `private, max-age=${maxAge}` : "private, no-store", "Referrer-Policy": "no-referrer" });
      res.redirect(302, url);
    },
    /** Baja el archivo a /tmp (para leerlo con node:sqlite). */
    async localFile(k) {
      const buf = await this.get(k);
      if (!buf) return null;
      const p = join(tmpdir(), `${bucket}-${basename(assertKey(k))}`);
      writeFileSync(p, buf);
      return p;
    },
  };
}

const cache = new Map();
/** El almacenamiento de un bucket. */
export function storage(bucket) {
  if (!BUCKETS.includes(bucket)) throw new Error(`bucket desconocido: ${bucket}`);
  const kind = cloudStorage() ? "supabase" : "local";
  const id = `${kind}:${bucket}`;
  if (!cache.has(id)) cache.set(id, kind === "supabase" ? supabaseDriver(bucket) : localStore(LOCAL_DIRS[bucket]));
  return cache.get(id);
}

/** Crea los buckets privados que falten (Supabase). Idempotente; se llama al arrancar. */
export async function ensureBuckets() {
  if (!cloudStorage()) return [];
  const base = `${process.env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
  const r = await fetch(`${base}/bucket`, { headers: h });
  if (!r.ok) throw new Error(`storage buckets: ${r.status}`);
  const existing = new Set((await r.json()).map((b) => b.id));
  const created = [];
  for (const b of BUCKETS) {
    if (existing.has(b)) continue;
    const c = await fetch(`${base}/bucket`, { method: "POST", headers: h, body: JSON.stringify({ id: b, name: b, public: false }) });
    if (c.ok) created.push(b);
  }
  return created;
}

/** ¿Algún bucket quedó público por error? (se avisa en el estado de la app). */
export async function publicBuckets() {
  if (!cloudStorage()) return [];
  const base = `${process.env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${base}/bucket`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
  if (!r.ok) return [];
  return (await r.json()).filter((b) => BUCKETS.includes(b.id) && b.public).map((b) => b.id);
}
