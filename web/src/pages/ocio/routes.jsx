import { Navigate, Route } from "react-router-dom";
import { OcioLayout } from "./OcioLayout.jsx";
import { OcioInicio } from "./OcioInicio.jsx";
import { Biblioteca } from "./Biblioteca.jsx";
import { ObraDetalle } from "./ObraDetalle.jsx";
import { OcioSalidas } from "./OcioSalidas.jsx";
import { Estadisticas } from "./Estadisticas.jsx";
import { ResumenAnual } from "./ResumenAnual.jsx";

export const ocioRoutes = [
  <Route key="ocio" path="/ocio" element={<OcioLayout />}>
    <Route index element={<OcioInicio />} />
    <Route path="biblioteca" element={<Biblioteca />} />
    <Route path="biblioteca/:slug" element={<Biblioteca />} />
    <Route path="obra/:id" element={<ObraDetalle />} />
    <Route path="salidas" element={<OcioSalidas />} />
    <Route path="estadisticas" element={<Estadisticas />} />
    <Route path="resumen" element={<ResumenAnual />} />
    {/* Ruta vieja (antes del rediseño) */}
    <Route path="medios" element={<Navigate to="/ocio/biblioteca" replace />} />
  </Route>,
];
