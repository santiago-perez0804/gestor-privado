import multer from "multer";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { unlink } from "node:fs/promises";
import { db, nowIso, certificatesDir } from "../db/index.js";

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"]);
const FIELDS = ["title", "issuer", "issuedAt", "expiresAt", "hours", "credentialId", "verifyUrl", "skills", "notes"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, certificatesDir),
  filename: (req, file, cb) => cb(null, randomUUID() + extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
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
    await unlink(join(certificatesDir, fileName));
  } catch {
    /* file already gone, nothing to clean up */
  }
}

export default function registerCertificatesRoutes(app) {
  app.get("/api/certificates", (req, res) => {
    res.json(db.prepare("SELECT * FROM certificates ORDER BY issuedAt DESC, createdAt DESC").all());
  });

  app.post("/api/certificates", (req, res) => {
    upload.single("file")(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message || "upload_failed" });
      if (!req.body.title) {
        await removeFile(req.file?.filename);
        return res.status(400).json({ error: "title_required" });
      }
      const ts = nowIso();
      const values = FIELDS.map((k) => clean(k, req.body[k]) ?? null);
      const info = db
        .prepare(
          `INSERT INTO certificates
            (${FIELDS.join(", ")}, fileName, mimeType, createdAt, updatedAt)
           VALUES (${FIELDS.map(() => "?").join(", ")}, ?, ?, ?, ?)`
        )
        .run(...values, req.file?.filename ?? null, req.file?.mimetype ?? null, ts, ts);
      res.status(201).json(db.prepare("SELECT * FROM certificates WHERE id = ?").get(info.lastInsertRowid));
    });
  });

  app.put("/api/certificates/:id", (req, res) => {
    upload.single("file")(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message || "upload_failed" });
      const existing = db.prepare("SELECT * FROM certificates WHERE id = ?").get(req.params.id);
      if (!existing) {
        await removeFile(req.file?.filename);
        return res.status(404).json({ error: "not_found" });
      }
      const merged = { ...existing };
      for (const key of FIELDS) {
        const v = clean(key, req.body[key]);
        if (v !== undefined) merged[key] = v;
      }
      if (!merged.title) return res.status(400).json({ error: "title_required" });
      const removeExisting = req.body.removeFile === "true" || req.body.removeFile === true;
      if (req.file || removeExisting) {
        await removeFile(existing.fileName);
        merged.fileName = req.file?.filename ?? null;
        merged.mimeType = req.file?.mimetype ?? null;
      }
      db.prepare(
        `UPDATE certificates SET ${FIELDS.map((k) => `${k}=?`).join(", ")}, fileName=?, mimeType=?, updatedAt=? WHERE id=?`
      ).run(...FIELDS.map((k) => merged[k]), merged.fileName, merged.mimeType, nowIso(), req.params.id);
      res.json(db.prepare("SELECT * FROM certificates WHERE id = ?").get(req.params.id));
    });
  });

  app.delete("/api/certificates/:id", async (req, res) => {
    const cert = db.prepare("SELECT * FROM certificates WHERE id = ?").get(req.params.id);
    if (!cert) return res.status(404).json({ error: "not_found" });
    db.prepare("DELETE FROM certificates WHERE id = ?").run(req.params.id);
    await removeFile(cert.fileName);
    res.status(204).end();
  });
}
