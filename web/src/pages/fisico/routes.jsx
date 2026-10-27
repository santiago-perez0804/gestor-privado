import { Navigate, Route } from "react-router-dom";
import { FisicoLayout } from "./FisicoLayout.jsx";
import { FisicoHome } from "./FisicoHome.jsx";
import { Peso } from "./Peso.jsx";
import { PlanRutinas } from "./PlanRutinas.jsx";
import { Records } from "./Records.jsx";
import { Medidas } from "./Medidas.jsx";
import { Fotos } from "./Fotos.jsx";

export const fisicoRoutes = [
  <Route key="fisico" path="/fisico" element={<FisicoLayout />}>
    <Route index element={<FisicoHome />} />
    <Route path="plan" element={<PlanRutinas />} />
    <Route path="plan/:planId" element={<PlanRutinas />} />
    <Route path="records" element={<Records />} />
    <Route path="records/:exerciseId" element={<Records />} />
    <Route path="peso" element={<Peso />} />
    {/* Ruta vieja */}
    <Route path="progreso" element={<Navigate to="/fisico/peso" replace />} />
    <Route path="medidas" element={<Medidas />} />
    <Route path="fotos" element={<Fotos />} />
  </Route>,
];
