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

  // plans
  getPlans: () => get("/plans"),
  getPlan: (id) => get(`/plans/${id}`),
  addPlan: (data) => post("/plans", data),
  updatePlan: (id, data) => put(`/plans/${id}`, data),
  deletePlan: (id) => del(`/plans/${id}`),

  // routines
  addRoutine: (planId, data) => post(`/plans/${planId}/routines`, data),
  getRoutine: (id) => get(`/routines/${id}`),
  updateRoutine: (id, data) => put(`/routines/${id}`, data),
  deleteRoutine: (id) => del(`/routines/${id}`),

  // routine exercises
  addRoutineExercise: (routineId, data) => post(`/routines/${routineId}/exercises`, data),
  updateRoutineExercise: (id, data) => put(`/routine-exercises/${id}`, data),
  deleteRoutineExercise: (id) => del(`/routine-exercises/${id}`),

  // exercise library
  searchExerciseLibrary: (params) => get(`/exercise-library?${toQuery(params)}`),
  getExercise: (id) => get(`/exercise-library/${id}`),

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
