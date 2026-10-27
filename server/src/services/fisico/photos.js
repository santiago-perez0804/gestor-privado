// Fotos de progreso: sesiones por fecha con poses (frente, perfil, espalda) y variantes (relajado,
// contraído). Privadas: se guardan sin metadatos y solo se sirven por la API. Para comparar dos fechas
// trae qué cambió entre ellas (peso de tendencia, cintura, brazo y entrenos).
import { POSES, VARIANTS } from "../../../../shared/fisico/constants.js";
import { addDays, dayRange, weekday } from "../../../../shared/fisico/dates.js";
import { byZone, changeBetween, nextDue } from "../../../../shared/fisico/measurements.js";
import { validateImage } from "../../lib/ocio/images.js";
import { stripJpegMetadata, stripPngMetadata } from "../../lib/imageMeta.js";
import { bad, notFound, nowIso, getSettings, today } from "./common.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BYTES = 15 * 1024 * 1024;

export function createPhotos(db, { files, body, plans }) {
  const toPhoto = (p) => ({ id: p.id, sessionId: p.sessionId, pose: p.pose, variant: p.variant, note: p.note, width: p.width, height: p.height, hasThumb: !!p.thumbKey });

  function list() {
    const settings = getSettings(db);
    const photos = db.prepare("SELECT * FROM photos ORDER BY id").all();
    const sessions = db
      .prepare("SELECT * FROM photo_sessions ORDER BY date DESC, id DESC")
      .all()
      .map((s) => ({ id: s.id, date: s.date, note: s.note, trendKg: body.trendOn(s.date), photos: photos.filter((p) => p.sessionId === s.id).map(toPhoto) }))
      .filter((s) => s.photos.length);
    return { sessions, next: nextDue(sessions[0]?.date ?? null, settings.photoEveryDays, today(db)), everyDays: settings.photoEveryDays };
  }

  /** Sube una foto (ya re-codificada en el navegador) y su miniatura. Reemplaza la de esa pose/variante. */
  function upload({ image, thumb, date, pose = "front", variant = "relaxed", note }) {
    if (!DATE.test(date || "")) throw bad("invalid_date");
    if (!POSES[pose]) throw bad("invalid_pose");
    if (!VARIANTS[variant]) throw bad("invalid_variant");
    const info = validateImage(image, { maxBytes: MAX_BYTES });
    if (!["image/jpeg", "image/png"].includes(info.mime)) throw Object.assign(new Error("unsupported_type"), { status: 415 });
    const strip = (buf, mime) => (mime === "image/png" ? stripPngMetadata(buf) : stripJpegMetadata(buf));
    const ext = info.mime === "image/png" ? "png" : "jpg";
    let thumbInfo = null;
    if (thumb?.length) {
      thumbInfo = validateImage(thumb, { maxBytes: 2 * 1024 * 1024 });
      if (thumbInfo.mime !== "image/jpeg") throw bad("thumb_must_be_jpeg");
    }
    let session = db.prepare("SELECT id FROM photo_sessions WHERE date = ? ORDER BY id LIMIT 1").get(date);
    const ts = nowIso();
    if (!session) session = { id: Number(db.prepare("INSERT INTO photo_sessions (date, note, createdAt) VALUES (?, NULL, ?)").run(date, ts).lastInsertRowid) };
    const fileKey = files.save(strip(image, info.mime), ext);
    const thumbKey = thumbInfo ? files.save(stripJpegMetadata(thumb), "jpg", { thumbOf: fileKey }) : null;
    // La foto anterior de esa misma pose y variante en esa sesión se reemplaza.
    const old = db.prepare("SELECT * FROM photos WHERE sessionId = ? AND pose = ? AND variant = ?").get(session.id, pose, variant);
    if (old) removePhoto(old.id, { keepSession: true });
    const id = db
      .prepare("INSERT INTO photos (sessionId, pose, variant, fileKey, thumbKey, mime, width, height, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(session.id, pose, variant, fileKey, thumbKey, info.mime, info.width, info.height, note || null, ts).lastInsertRowid;
    return toPhoto(db.prepare("SELECT * FROM photos WHERE id = ?").get(id));
  }

  /** Archivo de una foto (o su miniatura) para servir por la API. */
  function file(id, { thumb = false } = {}) {
    const p = db.prepare("SELECT fileKey, thumbKey, mime FROM photos WHERE id = ?").get(Number(id));
    if (!p) throw notFound();
    const key = thumb && p.thumbKey ? p.thumbKey : p.fileKey;
    const path = files.path(key);
    if (!path) throw notFound("file_missing");
    return { path, mime: thumb && p.thumbKey ? "image/jpeg" : p.mime || "image/jpeg" };
  }

  /** Borra una foto y sus archivos; si la sesión queda vacía se borra (salvo al reemplazar). */
  function removePhoto(id, { keepSession = false } = {}) {
    const p = db.prepare("SELECT * FROM photos WHERE id = ?").get(Number(id));
    if (!p) return;
    db.prepare("DELETE FROM photos WHERE id = ?").run(p.id);
    files.remove(p.fileKey);
    if (p.thumbKey) files.remove(p.thumbKey);
    if (!keepSession && !db.prepare("SELECT 1 FROM photos WHERE sessionId = ?").get(p.sessionId)) db.prepare("DELETE FROM photo_sessions WHERE id = ?").run(p.sessionId);
  }

  function removeSession(id) {
    for (const p of db.prepare("SELECT id FROM photos WHERE sessionId = ?").all(Number(id))) removePhoto(p.id);
    db.prepare("DELETE FROM photo_sessions WHERE id = ?").run(Number(id));
  }

  /** Qué cambió entre dos fechas: tendencia de peso, cintura, brazo y entrenos hechos de los planificados. */
  function compare(from, to) {
    if (!DATE.test(from || "") || !DATE.test(to || "") || from > to) throw bad("invalid_range");
    const zones = byZone(db.prepare("SELECT measuredOn, zone, valueCm FROM measurements").all());
    const a = body.trendOn(from);
    const b = body.trendOn(to);
    const done = db.prepare("SELECT COUNT(*) AS n FROM workout_sessions WHERE status = 'done' AND localDate > ? AND localDate <= ?").get(from, to).n;
    // Planificados según la agenda del plan activo, día por día.
    const planId = plans.activeId();
    const sched = planId ? Object.fromEntries(plans.schedule(planId).map((d) => [d.weekday, d.routineId])) : {};
    const planned = from < to ? dayRange(addDays(from, 1), to).filter((d) => sched[weekday(d)] != null).length : 0;
    return {
      from,
      to,
      weeks: Math.round(((new Date(to) - new Date(from)) / 86_400_000 / 7) * 10) / 10,
      trendKg: a != null && b != null ? Math.round((b - a) * 10) / 10 : null,
      waistCm: changeBetween(zones.cintura, from, to),
      armCm: changeBetween(zones.brazo, from, to),
      workoutsDone: done,
      workoutsPlanned: planned,
    };
  }

  return { list, upload, file, removePhoto, removeSession, compare };
}
