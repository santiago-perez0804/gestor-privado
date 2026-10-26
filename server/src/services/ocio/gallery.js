// Galería de pixel art: alta con validación por contenido, edición, borrado (con sus archivos) y
// la configuración y secuencia del atril (guardada en `settings`).
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { validateImage, nextInventoryCode, easelSettings, easelSequence, dailyIndex, MAX_THUMB_BYTES } from "../../lib/ocio/images.js";
import { todayLocal } from "./library.js";

const EDITABLE = ["title", "technique", "sizeLabel", "createdOn", "description", "inventoryCode", "isFavorite", "showOnEasel"];
const SETTING_KEYS = { interval: "ocio.easel.interval", order: "ocio.easel.order", showOnHome: "ocio.easel.showOnHome" };
const err = (status, message) => Object.assign(new Error(message), { status });

export function createGallery(db, dir) {
  const toItem = (r) =>
    r && {
      ...r,
      isFavorite: !!r.isFavorite,
      showOnEasel: !!r.showOnEasel,
      url: `/artworks/${r.imagePath}`,
      thumbUrl: `/artworks/${r.thumbPath || r.imagePath}`,
    };

  function list({ favorites } = {}) {
    return db
      .prepare(`SELECT * FROM artworks ${favorites ? "WHERE isFavorite = 1" : ""} ORDER BY COALESCE(createdOn, substr(createdAt, 1, 10)) DESC, id DESC`)
      .all()
      .map(toItem);
  }

  function get(id) {
    const item = toItem(db.prepare("SELECT * FROM artworks WHERE id = ?").get(Number(id)));
    if (!item) throw err(404, "not_found");
    return item;
  }

  function clean(fields) {
    const out = {};
    for (const k of EDITABLE) {
      if (!(k in fields)) continue;
      const v = fields[k];
      if (k === "isFavorite" || k === "showOnEasel") out[k] = v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
      else if (k === "createdOn") out[k] = /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? v : null;
      else out[k] = v == null || String(v).trim() === "" ? null : String(v).trim();
    }
    if ("title" in out && !out.title) throw err(400, "title_required");
    if (out.inventoryCode) out.inventoryCode = out.inventoryCode.toUpperCase();
    return out;
  }

  const codeTaken = (code, exceptId = 0) => !!db.prepare("SELECT 1 FROM artworks WHERE inventoryCode = ? COLLATE NOCASE AND id != ?").get(code, exceptId);
  const nextCode = () => nextInventoryCode(db.prepare("SELECT inventoryCode FROM artworks").all().map((r) => r.inventoryCode));

  /** Alta: guarda el original tal cual (pixel art sin recomprimir) y la miniatura si vino. */
  function create({ image, thumb, fields = {}, originalName }) {
    const info = validateImage(image);
    let thumbInfo = null;
    if (thumb?.length) {
      thumbInfo = validateImage(thumb, { maxBytes: MAX_THUMB_BYTES });
      if (thumbInfo.mime !== "image/png") throw err(415, "thumb_must_be_png");
    }
    const data = clean(fields);
    const title = data.title || String(originalName || "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Sin título";
    const code = data.inventoryCode || nextCode();
    if (codeTaken(code)) throw err(409, "inventory_code_taken");
    const base = randomUUID();
    const imagePath = `${base}.${info.ext}`;
    const thumbPath = thumbInfo ? `${base}.thumb.png` : null;
    writeFileSync(join(dir, imagePath), image);
    if (thumbPath) writeFileSync(join(dir, thumbPath), thumb);
    const now = new Date().toISOString();
    try {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO artworks (title, technique, sizeLabel, createdOn, description, inventoryCode, imagePath, thumbPath, width, height, mime, isFavorite, showOnEasel, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(title, data.technique ?? null, data.sizeLabel ?? `${info.width} × ${info.height} px`, data.createdOn ?? null, data.description ?? null, code, imagePath, thumbPath, info.width, info.height, info.mime, data.isFavorite ?? 0, data.showOnEasel ?? 1, now, now);
      return get(lastInsertRowid);
    } catch (e) {
      removeFiles({ imagePath, thumbPath });
      throw e;
    }
  }

  function update(id, fields) {
    const current = get(id);
    const data = clean(fields);
    if (data.inventoryCode && codeTaken(data.inventoryCode, current.id)) throw err(409, "inventory_code_taken");
    if ("inventoryCode" in data && !data.inventoryCode) data.inventoryCode = current.inventoryCode;
    const keys = Object.keys(data);
    if (keys.length) db.prepare(`UPDATE artworks SET ${keys.map((k) => `${k} = ?`).join(", ")}, updatedAt = ? WHERE id = ?`).run(...keys.map((k) => data[k]), new Date().toISOString(), current.id);
    return get(current.id);
  }

  function removeFiles({ imagePath, thumbPath }) {
    for (const f of [imagePath, thumbPath]) {
      if (!f) continue;
      const p = join(dir, f);
      try {
        if (existsSync(p)) unlinkSync(p);
      } catch {
        // si el archivo está en uso, queda huérfano; no es grave
      }
    }
  }

  function remove(id) {
    const current = get(id);
    db.prepare("DELETE FROM artworks WHERE id = ?").run(current.id);
    removeFiles(current);
  }

  function getEaselSettings() {
    const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${Object.values(SETTING_KEYS).map(() => "?").join(", ")})`).all(...Object.values(SETTING_KEYS));
    const raw = {};
    for (const [name, key] of Object.entries(SETTING_KEYS)) raw[name] = rows.find((r) => r.key === key)?.value;
    return easelSettings(raw);
  }

  function setEaselSettings(patch) {
    const next = easelSettings({ ...getEaselSettings(), ...patch });
    const up = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    for (const [name, key] of Object.entries(SETTING_KEYS)) up.run(key, name === "showOnHome" ? (next.showOnHome ? "1" : "0") : next[name]);
    return next;
  }

  /** Lo que necesita el atril (Inicio o modo museo): configuración, obras en orden y por cuál arrancar. */
  function easel(today = todayLocal()) {
    const settings = getEaselSettings();
    const items = easelSequence(list(), { order: settings.order, seed: today });
    return { settings, items, startIndex: settings.interval === "daily" ? dailyIndex(items.length, today) : 0, total: db.prepare("SELECT COUNT(*) AS n FROM artworks").get().n };
  }

  return { list, get, create, update, remove, getEaselSettings, setEaselSettings, easel };
}
