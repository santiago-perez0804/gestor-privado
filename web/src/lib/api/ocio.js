import { get, post, put, del, toQuery } from "./request.js";

export const ocioApi = {
  // medios (películas, series, libros, videojuegos)
  getMediaItems: (params) => get(`/media-items?${toQuery(params)}`),
  getMediaItem: (id) => get(`/media-items/${id}`),
  addMediaItem: (data) => post("/media-items", data),
  updateMediaItem: (id, data) => put(`/media-items/${id}`, data),
  deleteMediaItem: (id) => del(`/media-items/${id}`),

  // salidas y planes
  getOutings: (params) => get(`/outings?${toQuery(params)}`),
  addOuting: (data) => post("/outings", data),
  updateOuting: (id, data) => put(`/outings/${id}`, data),
  deleteOuting: (id) => del(`/outings/${id}`),
};
