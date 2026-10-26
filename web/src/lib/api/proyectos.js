import { get, post, put, del, toQuery } from "./request.js";

function sendForm(path, method, formData) {
  return fetch(`/api${path}`, { method, body: formData }).then(async (res) => {
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `request_failed_${res.status}`);
    return data;
  });
}

export const proyectosApi = {
  // proyectos (por ahora cuentas de Instagram)
  getProjects: () => get("/projects"),
  getProject: (id) => get(`/projects/${id}`),
  addProject: (data) => post("/projects", data),
  updateProject: (id, data) => put(`/projects/${id}`, data),
  deleteProject: (id) => del(`/projects/${id}`),
  getProjectLive: (id, { fresh } = {}) => get(`/projects/${id}/live${fresh ? "?fresh=1" : ""}`),
  getProjectSnapshots: (id, params) => get(`/projects/${id}/snapshots?${toQuery(params)}`),

  // certificados (multipart: datos + archivo opcional)
  getCertificates: () => get("/certificates"),
  addCertificate: (formData) => sendForm("/certificates", "POST", formData),
  updateCertificate: (id, formData) => sendForm(`/certificates/${id}`, "PUT", formData),
  deleteCertificate: (id) => del(`/certificates/${id}`),
};
