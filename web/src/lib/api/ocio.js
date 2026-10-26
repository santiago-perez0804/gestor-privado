import { get, post, put, del, toQuery } from "./request.js";

export const ocioApi = {
  // biblioteca (obras + tu entrada + pasadas)
  getOcioHome: (year) => get(`/ocio/home?${toQuery({ year })}`),
  getOcioCounts: () => get("/ocio/counts"),
  getOcioGenres: () => get("/ocio/genres"),
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

  // salidas
  getOutings: (params) => get(`/outings?${toQuery(params)}`),
  addOuting: (data) => post("/outings", data),
  updateOuting: (id, data) => put(`/outings/${id}`, data),
  deleteOuting: (id) => del(`/outings/${id}`),
};
