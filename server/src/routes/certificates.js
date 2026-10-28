// Certificados (Proyectos): datos y, opcional, el archivo (PDF o imagen) en el almacenamiento privado.
import multer from "multer";
import { randomUUID } from "node:crypto";
import { db, nowIso } from "../db/index.js";
import { storage as fileStorage } from "../services/storage/index.js";

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"]);
const EXT = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic" };
const files = () => fileStorage("certificates");
const FIELDS = ["title", "issuer", "issuedAt", "expiresAt", "hours", "credentialId", "verifyUrl", "skills", "notes"];

// En memoria: el archivo se guarda recién cuando el pedido es válido (y va al bucket privado).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error("invalid_file_type"));
    cb(null, true);
  },
});

// Multipart manda todo como string; los vacíos se guardan como NULL.
function clean(key, value) {
  if (value === undefined) return undefined;
  if (value === "" || value === null) return null;
  if (key === "hours") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return value;
}

async function removeFile(fileName) {
  if (!fileName) return;
  try {
    await files().remove(fileName);
  } catch {
    /* ya no estaba: nada que limpiar */
  }
}

/** Guarda el archivo subido (si hay) y devuelve su nombre. */
async function saveFile(file) {
  if (!file) return null;
  const name = randomUUID() + EXT[file.mimetype];
  await files().put(name, file.buffer, { contentType: file.mimetype });
  return name;
}

/** multer + handler async: los errores van al manejador de errores (no quedan colgados). */
const withUpload = (fn) => (req, res, next) =>
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "upload_failed" });
    Promise.resolve(fn(req, res)).catch(next);
  });

export default function registerCertificatesRoutes(app) {
  app.get("/api/certificates", async (req, res) => {
    res.json(await db.prepare("SELECT * FROM certificates ORDER BY issuedAt DESC, createdAt DESC").all());
  });

  app.post(
    "/api/certificates",
    withUpload(async (req, res) => {
      if (!req.body.title) return res.status(400).json({ error: "title_required" });
      const fileName = await saveFile(req.file);
      const ts = nowIso();
      const values = FIELDS.map((k) => clean(k, req.body[k]) ?? null);
      const info = await db
        .prepare(
          `INSERT INTO certificates
            (${FIELDS.join(", ")}, fileName, mimeType, createdAt, updatedAt)
           VALUES (${FIELDS.map(() => "?").join(", ")}, ?, ?, ?, ?)`
        )
        .run(...values, fileName, req.file?.mimetype ?? null, ts, ts);
      res.status(201).json(await db.prepare("SELECT * FROM certificates WHERE id = ?").get(info.lastInsertRowid));
    })
  );

  app.put(
    "/api/certificates/:id",
    withUpload(async (req, res) => {
      const existing = await db.prepare("SELECT * FROM certificates WHERE id = ?").get(req.params.id);
      if (!existing) return res.status(404).json({ error: "not_found" });
      const merged = { ...existing };
      for (const key of FIELDS) {
        const v = clean(key, req.body[key]);
        if (v !== undefined) merged[key] = v;
      }
      if (!merged.title) return res.status(400).json({ error: "title_required" });
      const removeExisting = req.body.removeFile === "true" || req.body.removeFile === true;
      if (req.file || removeExisting) {
        await removeFile(existing.fileName);
        merged.fileName = await saveFile(req.file);
        merged.mimeType = req.file?.mimetype ?? null;
      }
      await db.prepare(
        `UPDATE certificates SET ${FIELDS.map((k) => `${k}=?`).join(", ")}, fileName=?, mimeType=?, updatedAt=? WHERE id=?`
      ).run(...FIELDS.map((k) => merged[k]), merged.fileName, merged.mimeType, nowIso(), req.params.id);
      res.json(await db.prepare("SELECT * FROM certificates WHERE id = ?").get(req.params.id));
    })
  );

  app.delete("/api/certificates/:id", async (req, res) => {
    const cert = await db.prepare("SELECT * FROM certificates WHERE id = ?").get(req.params.id);
    if (!cert) return res.status(404).json({ error: "not_found" });
    await db.prepare("DELETE FROM certificates WHERE id = ?").run(req.params.id);
    await removeFile(cert.fileName);
    res.status(204).end();
  });
}
