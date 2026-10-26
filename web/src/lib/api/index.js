import { fisicoApi } from "./fisico.js";
import { gastosApi } from "./gastos.js";
import { ocioApi } from "./ocio.js";
import { proyectosApi } from "./proyectos.js";

export const api = {
  ...fisicoApi,
  ...gastosApi,
  ...ocioApi,
  ...proyectosApi,
  exportUrl: "/api/export",
};
