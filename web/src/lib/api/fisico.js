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
  // inicio y hábitos
  getFisicoHome: () => get("/fisico/home"),
  getHabits: () => get("/fisico/habits"),
  addHabit: (data) => post("/fisico/habits", data),
  updateHabit: (id, data) => put(`/fisico/habits/${id}`, data),
  toggleHabit: (id, data) => put(`/fisico/habits/${id}/days`, data),
  // medidas
  getMeasurements: () => get("/fisico/measurements"),
  saveMeasurementSession: (data) => post("/fisico/measurements/sessions", data),
  deleteMeasurementSession: (id) => del(`/fisico/measurements/sessions/${id}`),
  updateMeasurement: (id, data) => put(`/fisico/measurements/${id}`, data),
  deleteMeasurement: (id) => del(`/fisico/measurements/${id}`),
  // peso
  getWeightSummary: () => get("/fisico/weight"),
  setWeightGoal: (data) => put("/fisico/goal", data),
  // récords
  getRecords: () => get("/fisico/records"),
  getRecentRecords: (days) => get(`/fisico/records/recent?${toQuery({ days })}`),
  getRecordDetail: (exerciseId) => get(`/fisico/records/${exerciseId}`),
  // entreno en vivo
  getWorkoutToday: () => get("/fisico/workout/today"),
  getWorkoutStart: (routineId) => get(`/fisico/workout/start?${toQuery({ routineId })}`),
  getWorkoutExercise: (id) => get(`/fisico/workout/exercise/${id}`),
  getFisicoWeek: (day) => get(`/fisico/week?${toQuery({ day })}`),
  getSessions: (params) => get(`/fisico/sessions?${toQuery(params)}`),
  getInProgressSession: () => get("/fisico/sessions/in-progress"),
  getSession: (id) => get(`/fisico/sessions/${id}`),
  getSessionSummary: (id) => get(`/fisico/sessions/${id}/summary`),
  saveSession: (id, snapshot) => put(`/fisico/sessions/${id}`, snapshot),


  // inicio y hábitos
  getFisicoHome: () => get("/fisico/home"),
  getHabits: () => get("/fisico/habits"),
  addHabit: (data) => post("/fisico/habits", data),
  updateHabit: (id, data) => put(`/fisico/habits/${id}`, data),
  toggleHabit: (id, data) => put(`/fisico/habits/${id}/days`, data),
  // medidas
  getMeasurements: () => get("/fisico/measurements"),
  saveMeasurementSession: (data) => post("/fisico/measurements/sessions", data),
  deleteMeasurementSession: (id) => del(`/fisico/measurements/sessions/${id}`),
  updateMeasurement: (id, data) => put(`/fisico/measurements/${id}`, data),
  deleteMeasurement: (id) => del(`/fisico/measurements/${id}`),
  // peso
  getWeightSummary: () => get("/fisico/weight"),
  setWeightGoal: (data) => put("/fisico/goal", data),
  // fotos de progreso (privadas: se piden por la API)
  getPhotos: () => get("/fisico/photos"),
  comparePhotos: (from, to) => get(`/fisico/photos/compare?${toQuery({ from, to })}`),
  photoUrl: (id, { thumb = false } = {}) => `/api/fisico/photos/${id}/file${thumb ? "?size=thumb" : ""}`,
  uploadPhoto: async ({ image, thumb, date, pose, variant, note }) => {
    const fd = new FormData();
    fd.append("image", image, "foto.jpg");
    if (thumb) fd.append("thumb", thumb, "mini.jpg");
    for (const [k, v] of Object.entries({ date, pose, variant, note })) if (v) fd.append(k, v);
    const res = await fetch("/api/fisico/photos", { method: "POST", body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || data?.error || `request_failed_${res.status}`);
    return data;
  },
  deletePhoto: (id) => del(`/fisico/photos/${id}`),
  deletePhotoSession: (id) => del(`/fisico/photo-sessions/${id}`),
};
