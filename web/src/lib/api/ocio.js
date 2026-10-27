import { request, get, post, put, del, toQuery } from "./request.js";

export const ocioApi = {
  // biblioteca (obras + tu entrada + pasadas)
  getOcioHome: (year) => get(`/ocio/home?${toQuery({ year })}`),
  getOcioCounts: () => get("/ocio/counts"),
  getOcioGenres: () => get("/ocio/genres"),
  getOcioStats: (year, type) => get(`/ocio/stats?${toQuery({ year, type })}`),
  getOcioWrapped: (year) => get(`/ocio/wrapped?${toQuery({ year })}`),
  getLibrary: (params) => get(`/ocio/library?${toQuery(params)}`),
  getLibraryItem: (id) => get(`/ocio/library/${id}`),
  findLibraryDuplicate: (params) => get(`/ocio/library/duplicate?${toQuery(params)}`),
  addToLibrary: (data) => post("/ocio/library", data),
  updateLibraryItem: (id, data) => put(`/ocio/library/${id}`, data),
  deleteLibraryItem: (id) => del(`/ocio/library/${id}`),
  rereadLibraryItem: (id, data) => post(`/ocio/library/${id}/reread`, data || {}),
  updatePass: (id, data) => put(`/ocio/passes/${id}`, data),
  addReview: (entryId, data) => post(`/ocio/library/${entryId}/reviews`, data),
  updateReview: (id, data) => put(`/ocio/reviews/${id}`, data),
  deleteReview: (id) => del(`/ocio/reviews/${id}`),
  addHighlight: (workId, data) => post(`/ocio/works/${workId}/highlights`, data),
  deleteHighlight: (id) => del(`/ocio/highlights/${id}`),
  getOcioGoals: (year) => get(`/ocio/goals/${year}`),
  setOcioGoal: (year, type, target) => put(`/ocio/goals/${year}/${type}`, { target }),

  // catálogos externos (TMDB, Open Library, Google Books, RAWG) vía el server
  getCatalogStatus: () => get("/catalog/status"),
  searchCatalog: (type, q, signal) => get(`/catalog/search?${toQuery({ type, q })}`, { signal }),
  getCatalogDetails: (type, source, id) => get(`/catalog/details?${toQuery({ type, source, id })}`),

  // KOReader (estadísticas de lectura del Kindle)
  previewKoreader: async (file, gapMinutes) => {
    const fd = new FormData();
    fd.append("file", file);
    if (gapMinutes) fd.append("gapMinutes", String(gapMinutes));
    const res = await fetch("/api/ocio/koreader/preview", { method: "POST", body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(data?.message || data?.error || `request_failed_${res.status}`), { data });
    return data;
  },
  importKoreader: (data) => post("/ocio/koreader/import", data),
  getKoreaderStatus: () => get("/ocio/koreader/status"),
  // Sincronización automática por Dropbox
  getDropboxStatus: () => get("/dropbox/status"),
  dropboxAuthUrl: "/api/dropbox/auth",
  disconnectDropbox: () => post("/dropbox/disconnect", {}),
  setKoreaderSyncPath: (path) => put("/ocio/koreader/sync-settings", { path }),
  syncKoreader: (opts = {}) => post("/ocio/koreader/sync", opts),
  getKoreaderPending: () => get("/ocio/koreader/pending"),
  resolveKoreaderPending: (mapping) => post("/ocio/koreader/pending", { mapping }),

  // Galería y atril
  getArtworks: (params) => get(`/ocio/artworks?${toQuery(params || {})}`),
  uploadArtwork: async (file, thumb, fields = {}) => {
    const fd = new FormData();
    fd.append("image", file);
    if (thumb) fd.append("thumb", thumb, "thumb.png");
    for (const [k, v] of Object.entries(fields)) if (v != null) fd.append(k, String(v));
    const res = await fetch("/api/ocio/artworks", { method: "POST", body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(data?.message || data?.error || `request_failed_${res.status}`), { data });
    return data;
  },
  updateArtwork: (id, data) => request(`/ocio/artworks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteArtwork: (id) => del(`/ocio/artworks/${id}`),
  getEasel: () => get("/ocio/easel"),
  setEaselSettings: (data) => put("/ocio/easel/settings", data),

  // Google Calendar (OAuth y sincronización viven en el server)
  getGoogleStatus: () => get("/google/status"),
  syncGoogle: () => post("/google/sync", {}),
  disconnectGoogle: () => post("/google/disconnect", {}),
  getGoogleLog: () => get("/google/log"),
  googleAuthUrl: "/api/google/auth",

  // salidas
  getOutings: (params) => get(`/outings?${toQuery(params)}`),
  addOuting: (data) => post("/outings", data),
  updateOuting: (id, data) => put(`/outings/${id}`, data),
  deleteOuting: (id) => del(`/outings/${id}`),
  getOutingsSummary: (month) => get(`/outings/summary?${toQuery({ month })}`),
  parseOuting: (text) => post("/outings/parse", { text }),
  suggestOutingsForExpense: (params) => get(`/outings/suggest?${toQuery(params)}`),
  getOutingExpenses: (id) => get(`/outings/${id}/expenses`),
  getOutingCandidates: (id) => get(`/outings/${id}/expense-candidates`),
  linkOutingExpense: (id, expenseId) => post(`/outings/${id}/expenses`, { expenseId }),
  unlinkOutingExpense: (id, expenseId) => del(`/outings/${id}/expenses/${expenseId}`),
};
