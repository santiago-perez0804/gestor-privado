// Físico (rediseño): ajustes, biblioteca de ejercicios, planes, rutinas y agenda.
// Los cálculos viven en shared/fisico; acá solo se lee/escribe la base y se arma la respuesta.
import { db } from "../db/index.js";
import { handle } from "../lib/http.js";
import { getSettings, saveSettings } from "../services/fisico/common.js";
import { createExercises } from "../services/fisico/exercises.js";
import { createHistory } from "../services/fisico/history.js";
import { createPlans } from "../services/fisico/plans.js";
import { createBody } from "../services/fisico/body.js";
import { createWorkouts } from "../services/fisico/workouts.js";
import { createRecords } from "../services/fisico/records.js";

export function fisicoServices() {
  const exercises = createExercises(db);
  const history = createHistory(db);
  const plans = createPlans(db, { history });
  const body = createBody(db);
  const workouts = createWorkouts(db, { history, plans, body });
  const records = createRecords(db, { history, plans });
  return { exercises, history, plans, body, workouts, records };
}

export default function registerFisicoRoutes(app) {
  const { exercises, plans, workouts, records } = fisicoServices();
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
