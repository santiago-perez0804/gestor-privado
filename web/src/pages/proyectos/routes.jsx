import { Route } from "react-router-dom";
import { ProyectosHome } from "./ProyectosHome.jsx";
import { ProyectosLista } from "./ProyectosLista.jsx";
import { ProyectoDetalle } from "./ProyectoDetalle.jsx";
import { Certificados } from "./Certificados.jsx";

export const proyectosRoutes = [
  <Route key="proyectos-home" path="/proyectos" element={<ProyectosHome />} />,
  <Route key="proyectos-lista" path="/proyectos/lista" element={<ProyectosLista />} />,
  <Route key="proyectos-certificados" path="/proyectos/certificados" element={<Certificados />} />,
  <Route key="proyectos-detalle" path="/proyectos/:id" element={<ProyectoDetalle />} />,
];
