// API de la biblioteca de Ocio (obras, entradas, pasadas, reseñas, subrayados, metas) e Inicio.
import { db } from "../db/index.js";
import { downloadCover } from "../services/catalog/covers.js";
import { createLibrary, todayLocal } from "../services/ocio/library.js";
import { buildHome, sidebarCounts } from "../services/ocio/home.js";
import { createOcioStats } from "../services/ocio/stats.js";
import { GENRES } from "../lib/ocio/genres.js";
import { handle } from "../lib/http.js";

const notFound = () => Object.assign(new Error("not_found"), { status: 404 });

export default function registerOcioRoutes(app) {
  const lib = createLibrary(db);
  const ocioStats = createOcioStats(db, lib);
  const yearOf = (req) => parseInt(req.query.year, 10) || Number(todayLocal().slice(0, 4));

  /** Baja la portada remota a data/covers en segundo plano (si falla, queda la URL del catálogo). */
  async function cacheCover(item) {
    if (!item?.cover || item.cover.startsWith("/covers/")) return;
    downloadCover(item.cover, item.workId)
      .then(async (name) => name && await lib.updateWork(item.workId, { coverPath: name }))
      .catch((err) => console.warn(`[ocio] no se pudo bajar la portada de "${item.title}": ${err.message}`));
  }

  app.get("/api/ocio/genres", handle(() => GENRES));

  app.get("/api/ocio/counts", handle(async () => await sidebarCounts(db, todayLocal())));

  app.get(
    "/api/ocio/home",
    handle(async (req) => {
      const today = todayLocal();
      const year = parseInt(req.query.year, 10) || Number(today.slice(0, 4));
      return await buildHome(db, lib, { year, today });
    })
  );

  // Estadísticas: ?year=2026&type=book (general si no hay tipo). Cacheadas hasta que cambien los datos.
  app.get("/api/ocio/stats", handle((req) => ocioStats.stats(yearOf(req), req.query.type || null)));
  // Resumen anual ("Wrapped"): todo de una vez.
  app.get("/api/ocio/wrapped", handle((req) => ocioStats.wrapped(yearOf(req))));

  app.get("/api/ocio/library", handle(async (req) => await lib.list(req.query)));

  // ¿Ya está? Lo usa la pantalla "Agregar" para marcar resultados del catálogo.
  app.get(
    "/api/ocio/library/duplicate",
    handle(async (req) => {
      const { type, title, originalTitle, creators, year, externalSource, externalId } = req.query;
      return {
        item: await lib.findDuplicate({ type, title, originalTitle, creators: creators ? String(creators).split("|") : [], year: year ? Number(year) : null, externalSource, externalId }),
      };
    })
  );

  app.get(
    "/api/ocio/library/:id",
    handle(async (req) => {
      const d = await lib.detail(Number(req.params.id));
      if (!d) throw notFound();
      return d;
    })
  );

  app.post(
    "/api/ocio/library",
    handle(async (req) => {
      const out = await lib.add(req.body);
      await cacheCover(out.item);
      return out;
    }, 201)
  );

  app.put(
    "/api/ocio/library/:id",
    handle(async (req) => {
      const item = await lib.updateEntry(Number(req.params.id), req.body);
      if (req.body?.work?.coverUrl) await cacheCover(item);
      return item;
    })
  );

  app.delete(
    "/api/ocio/library/:id",
    handle(async (req) => {
      await lib.remove(Number(req.params.id));
    })
  );

  app.post("/api/ocio/library/:id/reread", handle(async (req) => await lib.reread(Number(req.params.id), req.body || {})));

  app.put("/api/ocio/passes/:id", handle(async (req) => await lib.updatePass(Number(req.params.id), req.body)));

  app.post(
    "/api/ocio/library/:id/reviews",
    handle(async (req) => {
      if (!req.body?.text?.trim()) throw Object.assign(new Error("text_required"), { status: 400 });
      return await lib.addReview(Number(req.params.id), req.body);
    }, 201)
  );
  app.put("/api/ocio/reviews/:id", handle(async (req) => await lib.updateReview(Number(req.params.id), req.body)));
  app.delete(
    "/api/ocio/reviews/:id",
    handle(async (req) => {
      await db.prepare("DELETE FROM reviews WHERE id = ?").run(Number(req.params.id));
    })
  );

  app.post("/api/ocio/works/:workId/highlights", handle(async (req) => await lib.addHighlight(Number(req.params.workId), req.body), 201));
  app.delete(
    "/api/ocio/highlights/:id",
    handle(async (req) => {
      await db.prepare("DELETE FROM highlights WHERE id = ?").run(Number(req.params.id));
    })
  );

  app.get("/api/ocio/goals/:year", handle(async (req) => await lib.goals(Number(req.params.year))));
  app.put("/api/ocio/goals/:year/:type", handle(async (req) => await lib.setGoal(Number(req.params.year), req.params.type, Number(req.body?.target) || 0)));
}
