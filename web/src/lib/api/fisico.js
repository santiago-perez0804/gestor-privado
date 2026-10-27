import { get, post, put, del, toQuery } from "./request.js";

export const fisicoApi = {
  // weights
  getWeights: () => get("/weights"),
  addWeight: (data) => post("/weights", data),
  updateWeight: (id, data) => put(`/weights/${id}`, data),
  deleteWeight: (id) => del(`/weights/${id}`),

  // settings
  getSettings: () => get("/settings"),
  setSetting: (key, value) => put(`/settings/${key}`, { value }),
  deleteSetting: (key) => del(`/settings/${key}`),

  // plans (lista simple; la usa el widget de escritorio)
  getPlans: () => get("/plans"),

  // ---------- Físico (rediseño): /api/fisico ----------
  getFisicoSettings: () => get("/fisico/settings"),
  saveFisicoSettings: (data) => put("/fisico/settings", data),
  // biblioteca
  getExercises: (params) => get(`/fisico/exercises?${toQuery(params)}`),
  getExerciseAlternatives: (id) => get(`/fisico/exercises/${id}/alternatives`),
  addExercise: (data) => post("/fisico/exercises", data),
  updateExercise: (id, data) => put(`/fisico/exercises/${id}`, data),
  deleteExercise: (id) => del(`/fisico/exercises/${id}`),
  searchLegacyExercises: (params) => get(`/fisico/exercises/legacy?${toQuery(params)}`),
  importLegacyExercise: (libraryId, data = {}) => post(`/fisico/exercises/legacy/${encodeURIComponent(libraryId)}/import`, data),
  // planes y rutinas
  getFisicoPlans: () => get("/fisico/plans"),
  getActivePlan: () => get("/fisico/plans/active"),
  getFisicoPlan: (id) => get(`/fisico/plans/${id}`),
  addFisicoPlan: (data) => post("/fisico/plans", data),
  updateFisicoPlan: (id, data) => put(`/fisico/plans/${id}`, data),
  activatePlan: (id) => post(`/fisico/plans/${id}/activate`, {}),
  duplicatePlan: (id, data) => post(`/fisico/plans/${id}/duplicate`, data),
  deleteFisicoPlan: (id) => del(`/fisico/plans/${id}`),
  setPlanSchedule: (id, days) => put(`/fisico/plans/${id}/schedule`, { days }),
  addFisicoRoutine: (planId, data) => post(`/fisico/plans/${planId}/routines`, data),
  getFisicoRoutine: (id) => get(`/fisico/routines/${id}`),
  updateFisicoRoutine: (id, data) => put(`/fisico/routines/${id}`, data),
  deleteFisicoRoutine: (id) => del(`/fisico/routines/${id}`),
  addRoutineItem: (routineId, data) => post(`/fisico/routines/${routineId}/items`, data),
  reorderRoutineItems: (routineId, ids) => put(`/fisico/routines/${routineId}/items/order`, { ids }),
  updateRoutineItem: (id, data) => put(`/fisico/routine-items/${id}`, data),
  deleteRoutineItem: (id) => del(`/fisico/routine-items/${id}`),


  // exercise logs
  getExerciseLogs: (params) => get(`/exercise-logs?${toQuery(params)}`),
  addExerciseLog: (data) => post("/exercise-logs", data),
  updateExerciseLog: (id, data) => put(`/exercise-logs/${id}`, data),
  deleteExerciseLog: (id) => del(`/exercise-logs/${id}`),

  // récords personales
  getExerciseRecords: (params) => get(`/exercise-logs/records?${toQuery(params)}`),

  // medidas corporales
  getMeasurements: (params) => get(`/body-measurements?${toQuery(params)}`),
  addMeasurement: (data) => post("/body-measurements", data),
  updateMeasurement: (id, data) => put(`/body-measurements/${id}`, data),
  deleteMeasurement: (id) => del(`/body-measurements/${id}`),

  // fotos de progreso
  getProgressPhotos: () => get("/progress-photos"),
  uploadProgressPhoto: (formData) =>
    fetch("/api/progress-photos", { method: "POST", body: formData }).then(async (res) => {
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `request_failed_${res.status}`);
      return data;
    }),
  deleteProgressPhoto: (id) => del(`/progress-photos/${id}`),
};
