// Catálogos externos (pantalla "Agregar"): el server es el único que habla con TMDB, Open Library,
// Google Books y RAWG, así las keys nunca llegan al navegador.
import { db } from "../db/index.js";
import { createCatalog, catalogStatus } from "../services/catalog/index.js";
import { createLibrary } from "../services/ocio/library.js";

export default function registerCatalogRoutes(app) {
  const catalog = createCatalog(db);
  const lib = createLibrary(db);

  app.get("/api/catalog/status", (req, res) => res.json(catalogStatus()));

  app.get("/api/catalog/search", async (req, res, next) => {
    try {
      const { type, q } = req.query;
      const out = await catalog.catalogSearch(type, q);
      // Marca lo que ya tenés ("Ya en tu biblioteca"). Una coincidencia solo por título se marca
      // en el primer resultado que coincide (el más relevante), no en todos los homónimos.
      const titleMatched = new Set();
      out.results = out.results.map((r) => {
        const existing = lib.findDuplicate(r);
        if (!existing) return r;
        if (existing.match === "title") {
          if (titleMatched.has(existing.id)) return r;
          titleMatched.add(existing.id);
        }
        return { ...r, inLibrary: { id: existing.id, status: existing.status, match: existing.match } };
      });
      res.json(out);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      if (err.source) return res.status(502).json({ error: "catalog_unavailable", source: err.source, status: err.status });
      next(err);
    }
  });

  app.get("/api/catalog/details", async (req, res, next) => {
    try {
      const { type, source, id } = req.query;
      res.json((await catalog.catalogDetails(type, source, id)) ?? null);
    } catch (err) {
      if (err.source) return res.status(502).json({ error: "catalog_unavailable", source: err.source });
      next(err);
    }
  });
}

