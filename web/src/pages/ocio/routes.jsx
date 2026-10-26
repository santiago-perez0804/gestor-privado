import { Route } from "react-router-dom";
import { OcioHome } from "./OcioHome.jsx";
import { OcioMedios } from "./OcioMedios.jsx";
import { OcioSalidas } from "./OcioSalidas.jsx";

export const ocioRoutes = [
  <Route key="ocio-home" path="/ocio" element={<OcioHome />} />,
  <Route key="ocio-medios" path="/ocio/medios" element={<OcioMedios />} />,
  <Route key="ocio-salidas" path="/ocio/salidas" element={<OcioSalidas />} />,
];
