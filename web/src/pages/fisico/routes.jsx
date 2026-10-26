import { Route } from "react-router-dom";
import { FisicoHome } from "./FisicoHome.jsx";
import { FisicoProgreso } from "./FisicoProgreso.jsx";
import { PlanDetail } from "./PlanDetail.jsx";
import { RoutineDetail } from "./RoutineDetail.jsx";
import { ExerciseProgress } from "./ExerciseProgress.jsx";
import { Records } from "./Records.jsx";
import { Medidas } from "./Medidas.jsx";
import { Fotos } from "./Fotos.jsx";

export const fisicoRoutes = [
  <Route key="fisico-home" path="/fisico" element={<FisicoHome />} />,
  <Route key="fisico-progreso" path="/fisico/progreso" element={<FisicoProgreso />} />,
  <Route key="fisico-records" path="/fisico/records" element={<Records />} />,
  <Route key="fisico-medidas" path="/fisico/medidas" element={<Medidas />} />,
  <Route key="fisico-fotos" path="/fisico/fotos" element={<Fotos />} />,
  <Route key="fisico-plan" path="/fisico/plan/:planId" element={<PlanDetail />} />,
  <Route key="fisico-rutina" path="/fisico/rutina/:routineId" element={<RoutineDetail />} />,
  <Route key="fisico-ejercicio" path="/fisico/ejercicio/:exerciseLibraryId" element={<ExerciseProgress />} />,
];
