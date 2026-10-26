import { Route } from "react-router-dom";
import { GastosLayout } from "./GastosLayout.jsx";
import { GastosHome } from "./GastosHome.jsx";
import { GastosProyeccion } from "./GastosProyeccion.jsx";
import { Reportes } from "./Reportes.jsx";
import { Recurrentes } from "./Recurrentes.jsx";
import { Ingresos } from "./Ingresos.jsx";
import { Metas } from "./Metas.jsx";
import { Deudas } from "./Deudas.jsx";
import { Analisis } from "./Analisis.jsx";
import { Cuentas } from "./Cuentas.jsx";
import { Importar } from "./Importar.jsx";
import { Tips } from "./Tips.jsx";
import { InformeMensual } from "./InformeMensual.jsx";

export const gastosRoutes = [
  <Route key="gastos" path="/gastos" element={<GastosLayout />}>
    <Route index element={<GastosHome />} />
    <Route path="proyeccion" element={<GastosProyeccion />} />
    <Route path="reportes" element={<Reportes />} />
    <Route path="recurrentes" element={<Recurrentes />} />
    <Route path="ingresos" element={<Ingresos />} />
    <Route path="metas" element={<Metas />} />
    <Route path="deudas" element={<Deudas />} />
    <Route path="analisis" element={<Analisis />} />
    <Route path="cuentas" element={<Cuentas />} />
    <Route path="importar" element={<Importar />} />
    <Route path="tips" element={<Tips />} />
    <Route path="informe" element={<InformeMensual />} />
  </Route>,
];
