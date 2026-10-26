// Galería de pixel art y atril. Las imágenes se suben como multipart (campo "image" y, opcional,
// "thumb": la miniatura que arma el navegador) y se validan por contenido en el servicio.
import multer from "multer";
import { db, artworksDir } from "../db/index.js";
import { handle } from "../lib/http.js";
import { createGallery } from "../services/ocio/gallery.js";
import { MAX_IMAGE_BYTES } from "../lib/ocio/images.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 2 } }).fields([
  { name: "image", maxCount: 1 },
  { name: "thumb", maxCount: 1 },
]);

/** Errores de multer (archivo muy pesado, campo inesperado) como respuestas claras. */
const withUpload = (req, res, next) =>
  upload(req, res, (e) => {
    if (!e) return next();
    if (e.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "too_large", message: `La imagen pesa más de ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` });
    res.status(400).json({ error: e.code || "upload_failed", message: e.message });
  });

export default function registerGalleryRoutes(app) {
  const gallery = createGallery(db, artworksDir);

  app.get("/api/ocio/artworks", handle((req) => gallery.list({ favorites: req.query.favoritas === "1" })));
  app.get("/api/ocio/artworks/:id", handle((req) => gallery.get(req.params.id)));
  app.post(
    "/api/ocio/artworks",
    withUpload,
    handle((req) => {
      const image = req.files?.image?.[0];
      return gallery.create({ image: image?.buffer, thumb: req.files?.thumb?.[0]?.buffer, fields: req.body || {}, originalName: image?.originalname });
    }, 201)
  );
  app.patch("/api/ocio/artworks/:id", handle((req) => gallery.update(req.params.id, req.body || {})));
  app.delete("/api/ocio/artworks/:id", handle((req) => void gallery.remove(req.params.id)));

  app.get("/api/ocio/easel", handle(() => gallery.easel()));
  app.put("/api/ocio/easel/settings", handle((req) => gallery.setEaselSettings(req.body || {})));
}
