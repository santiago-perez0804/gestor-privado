import multer from "multer";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { unlink } from "node:fs/promises";
import { db, nowIso, photosDir } from "../db/index.js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photosDir),
  filename: (req, file, cb) => cb(null, randomUUID() + extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error("invalid_file_type"));
    cb(null, true);
  },
});

export default function registerProgressPhotosRoutes(app) {
  app.get("/api/progress-photos", (req, res) => {
    res.json(db.prepare("SELECT * FROM progress_photos ORDER BY date DESC").all());
  });

  app.post("/api/progress-photos", (req, res) => {
    upload.single("photo")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || "upload_failed" });
      if (!req.file) return res.status(400).json({ error: "photo_required" });
      const { date, notes } = req.body;
      if (!date) return res.status(400).json({ error: "date_required" });
      const info = db
        .prepare("INSERT INTO progress_photos (date, fileName, notes, createdAt) VALUES (?, ?, ?, ?)")
        .run(date, req.file.filename, notes || null, nowIso());
      res.status(201).json(db.prepare("SELECT * FROM progress_photos WHERE id = ?").get(info.lastInsertRowid));
    });
  });

  app.delete("/api/progress-photos/:id", async (req, res) => {
    const photo = db.prepare("SELECT * FROM progress_photos WHERE id = ?").get(req.params.id);
    if (!photo) return res.status(404).json({ error: "not_found" });
    db.prepare("DELETE FROM progress_photos WHERE id = ?").run(req.params.id);
    try {
      await unlink(join(photosDir, photo.fileName));
    } catch {
      /* file already gone, nothing to clean up */
    }
    res.status(204).end();
  });
}
