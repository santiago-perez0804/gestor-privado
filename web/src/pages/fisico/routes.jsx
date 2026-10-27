import { Route } from "react-router-dom";
import { FisicoLayout } from "./FisicoLayout.jsx";
import { FisicoHome } from "./FisicoHome.jsx";
import { FisicoProgreso } from "./FisicoProgreso.jsx";
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
    <Route path="progreso" element={<FisicoProgreso />} />
    <Route path="medidas" element={<Medidas />} />
    <Route path="fotos" element={<Fotos />} />
  </Route>,
];
