// Físico (rediseño): ajustes, biblioteca de ejercicios, planes, rutinas y agenda.
// Los cálculos viven en shared/fisico; acá solo se lee/escribe la base y se arma la respuesta.
import multer from "multer";
import { db, privatePhotosDir } from "../db/index.js";
import { handle } from "../lib/http.js";
import { getSettings, saveSettings } from "../services/fisico/common.js";
import { createExercises } from "../services/fisico/exercises.js";
import { createHistory } from "../services/fisico/history.js";
import { createPlans } from "../services/fisico/plans.js";
import { createBody } from "../services/fisico/body.js";
import { createWorkouts } from "../services/fisico/workouts.js";
import { createRecords } from "../services/fisico/records.js";
import { createMeasurements } from "../services/fisico/measurements.js";
import { createPhotos } from "../services/fisico/photos.js";
import { createPrivateFiles } from "../services/storage/privateFiles.js";

export function fisicoServices() {
  const exercises = createExercises(db);
  const history = createHistory(db);
  const plans = createPlans(db, { history });
  const body = createBody(db);
  const workouts = createWorkouts(db, { history, plans, body });
  const records = createRecords(db, { history, plans });
  const measurements = createMeasurements(db);
  const photos = createPhotos(db, { files: createPrivateFiles(privatePhotosDir), body, plans });
  return { exercises, history, plans, body, workouts, records, measurements, photos };
}

export default function registerFisicoRoutes(app) {
  const { exercises, plans, workouts, records, body, measurements, photos } = fisicoServices();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 2 } }).fields([
    { name: "image", maxCount: 1 },
    { name: "thumb", maxCount: 1 },
  ]);
  const B = "/api/fisico";

  app.get(`${B}/settings`, handle(() => getSettings(db)));
  app.put(`${B}/settings`, handle((req) => saveSettings(db, req.body || {})));

  // Biblioteca
  app.get(`${B}/exercises`, handle((req) => exercises.list(req.query)));
  app.get(`${B}/exercises/legacy`, handle((req) => exercises.searchLegacy(req.query)));
  app.post(`${B}/exercises/legacy/:libraryId/import`, handle((req) => exercises.importLegacy(req.params.libraryId, req.body || {}), 201));
  app.get(`${B}/exercises/:id`, handle((req) => exercises.get(req.params.id)));
  app.get(`${B}/exercises/:id/alternatives`, handle((req) => exercises.alternatives(req.params.id)));
  app.post(`${B}/exercises`, handle((req) => exercises.create(req.body || {}), 201));
  app.put(`${B}/exercises/:id`, handle((req) => exercises.update(req.params.id, req.body || {})));
  app.delete(`${B}/exercises/:id`, handle((req) => exercises.remove(req.params.id)));

  // Planes
  app.get(`${B}/plans`, handle(() => plans.list()));
  app.get(`${B}/plans/active`, handle(() => {
    const id = plans.activeId();
    return id ? plans.detail(id) : null;
  }));
  app.get(`${B}/plans/:id`, handle((req) => plans.detail(req.params.id)));
  app.post(`${B}/plans`, handle((req) => plans.create(req.body || {}), 201));
  app.put(`${B}/plans/:id`, handle((req) => plans.update(req.params.id, req.body || {})));
  app.post(`${B}/plans/:id/activate`, handle((req) => (plans.activate(req.params.id), plans.detail(req.params.id))));
  app.post(`${B}/plans/:id/duplicate`, handle((req) => plans.duplicate(req.params.id, req.body || {}), 201));
  app.delete(`${B}/plans/:id`, handle((req) => void plans.remove(req.params.id)));
  app.put(`${B}/plans/:id/schedule`, handle((req) => plans.setSchedule(Number(req.params.id), req.body?.days)));
  app.put(`${B}/plans/:id/routines/order`, handle((req) => plans.reorderRoutines(req.params.id, req.body?.ids)));

  // Rutinas y sus ejercicios
  app.post(`${B}/plans/:id/routines`, handle((req) => plans.createRoutine(Number(req.params.id), req.body || {}), 201));
  app.get(`${B}/routines/:id`, handle((req) => plans.routine(req.params.id)));
  app.put(`${B}/routines/:id`, handle((req) => plans.updateRoutine(req.params.id, req.body || {})));
  app.delete(`${B}/routines/:id`, handle((req) => void plans.deleteRoutine(req.params.id)));
  app.post(`${B}/routines/:id/items`, handle((req) => plans.addItem(req.params.id, req.body || {}), 201));
  app.put(`${B}/routines/:id/items/order`, handle((req) => plans.reorderItems(req.params.id, req.body?.ids)));
  app.put(`${B}/routine-items/:id`, handle((req) => plans.updateItem(req.params.id, req.body || {})));
  app.delete(`${B}/routine-items/:id`, handle((req) => plans.removeItem(req.params.id)));

  // Peso
  app.get(`${B}/weight`, handle(() => body.summary()));
  app.put(`${B}/goal`, handle((req) => body.setGoal(req.body || {})));

  // Medidas
  app.get(`${B}/measurements`, handle(() => measurements.summary()));
  app.post(`${B}/measurements/sessions`, handle((req) => ({ id: measurements.saveSession(req.body || {}) }), 201));
  app.delete(`${B}/measurements/sessions/:id`, handle((req) => void measurements.removeSession(req.params.id)));
  app.put(`${B}/measurements/:id`, handle((req) => void measurements.updateValue(req.params.id, req.body || {})));
  app.delete(`${B}/measurements/:id`, handle((req) => void measurements.removeValue(req.params.id)));

  // Fotos de progreso (privadas: sin carpeta pública; se sirven solo por acá, sin caché compartida)
  app.get(`${B}/photos`, handle(() => photos.list()));
  app.get(`${B}/photos/compare`, handle((req) => photos.compare(req.query.from, req.query.to)));
  app.post(`${B}/photos`, (req, res, next) =>
    upload(req, res, (e) => {
      if (e) return res.status(e.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: e.code || "upload_failed" });
      handle((r) => photos.upload({ image: r.files?.image?.[0]?.buffer, thumb: r.files?.thumb?.[0]?.buffer, ...r.body }), 201)(req, res, next);
    })
  );
  app.get(`${B}/photos/:id/file`, (req, res, next) => {
    try {
      const f = photos.file(req.params.id, { thumb: req.query.size === "thumb" });
      res.set({ "Cache-Control": "private, no-store", "Content-Type": f.mime, "Content-Disposition": "inline" });
      res.sendFile(f.path);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });
  app.delete(`${B}/photos/:id`, handle((req) => void photos.removePhoto(req.params.id)));
  app.delete(`${B}/photo-sessions/:id`, handle((req) => void photos.removeSession(req.params.id)));

  // Récords
  app.get(`${B}/records`, handle(() => records.list()));
  app.get(`${B}/records/recent`, handle((req) => records.recent({ days: Number(req.query.days) || 21 })));
  app.get(`${B}/records/:exerciseId`, handle((req) => {
    const d = records.detail(req.params.exerciseId);
    if (!d) throw Object.assign(new Error("not_found"), { status: 404 });
    return d;
  }));

  // Entreno en vivo
  app.get(`${B}/workout/today`, handle(() => workouts.todayInfo()));
  app.get(`${B}/workout/start`, handle((req) => workouts.startData({ routineId: req.query.routineId })));
  app.get(`${B}/workout/exercise/:id`, handle((req) => workouts.exerciseData(req.params.id)));
  app.get(`${B}/week`, handle((req) => workouts.week(req.query.day)));
  app.get(`${B}/sessions`, handle((req) => workouts.list(req.query)));
  app.get(`${B}/sessions/in-progress`, handle(() => workouts.inProgress()));
  app.get(`${B}/sessions/:id`, handle((req) => workouts.get(req.params.id)));
  app.get(`${B}/sessions/:id/summary`, handle((req) => workouts.summary(req.params.id)));
  // Snapshot completo e idempotente (la versión más nueva gana).
  app.put(`${B}/sessions/:id`, handle((req) => workouts.upsert(req.params.id, req.body || {})));
}
