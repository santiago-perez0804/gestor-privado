// API de la biblioteca de Ocio (obras, entradas, pasadas, reseñas, subrayados, metas) e Inicio.
import { db } from "../db/index.js";
import { createLibrary, todayLocal } from "../services/ocio/library.js";
import { buildHome, sidebarCounts } from "../services/ocio/home.js";
import { GENRES } from "../lib/ocio/genres.js";
import { handle } from "../lib/http.js";

const notFound = () => Object.assign(new Error("not_found"), { status: 404 });

export default function registerOcioRoutes(app) {
  const lib = createLibrary(db);

  app.get("/api/ocio/genres", handle(() => GENRES));

  app.get("/api/ocio/counts", handle(() => sidebarCounts(db, todayLocal())));

  app.get(
    "/api/ocio/home",
    handle((req) => {
      const today = todayLocal();
      const year = parseInt(req.query.year, 10) || Number(today.slice(0, 4));
      return buildHome(db, lib, { year, today });
    })
  );

  app.get("/api/ocio/library", handle((req) => lib.list(req.query)));

  // ¿Ya está? Lo usa la pantalla "Agregar" para marcar resultados del catálogo.
  app.get(
    "/api/ocio/library/duplicate",
    handle((req) => {
      const { type, title, year, externalSource, externalId } = req.query;
      return { item: lib.findDuplicate({ type, title, year: year ? Number(year) : null, externalSource, externalId }) };
    })
  );

  app.get(
    "/api/ocio/library/:id",
    handle((req) => {
      const d = lib.detail(Number(req.params.id));
      if (!d) throw notFound();
      return d;
    })
  );

  app.post(
    "/api/ocio/library",
    handle((req) => lib.add(req.body), 201)
  );

  app.put(
    "/api/ocio/library/:id",
    handle((req) => lib.updateEntry(Number(req.params.id), req.body))
  );

  app.delete(
    "/api/ocio/library/:id",
    handle((req) => {
      lib.remove(Number(req.params.id));
    })
  );

  app.post("/api/ocio/library/:id/reread", handle((req) => lib.reread(Number(req.params.id), req.body || {})));

  app.put("/api/ocio/passes/:id", handle((req) => lib.updatePass(Number(req.params.id), req.body)));

  app.post(
    "/api/ocio/library/:id/reviews",
    handle((req) => {
      if (!req.body?.text?.trim()) throw Object.assign(new Error("text_required"), { status: 400 });
      return lib.addReview(Number(req.params.id), req.body);
    }, 201)
  );
  app.put("/api/ocio/reviews/:id", handle((req) => lib.updateReview(Number(req.params.id), req.body)));
  app.delete(
    "/api/ocio/reviews/:id",
    handle((req) => {
      db.prepare("DELETE FROM reviews WHERE id = ?").run(Number(req.params.id));
    })
  );

  app.post("/api/ocio/works/:workId/highlights", handle((req) => lib.addHighlight(Number(req.params.workId), req.body), 201));
  app.delete(
    "/api/ocio/highlights/:id",
    handle((req) => {
      db.prepare("DELETE FROM highlights WHERE id = ?").run(Number(req.params.id));
    })
  );

  app.get("/api/ocio/goals/:year", handle((req) => lib.goals(Number(req.params.year))));
  app.put("/api/ocio/goals/:year/:type", handle((req) => lib.setGoal(Number(req.params.year), req.params.type, Number(req.body?.target) || 0)));
}
