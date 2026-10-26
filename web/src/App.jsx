import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/common/AppShell.jsx";
import { BottomNav } from "./components/common/BottomNav.jsx";
import { ThemeToggle } from "./components/common/ThemeToggle.jsx";
import { ExportButton } from "./components/common/ExportButton.jsx";
import { ErrorBoundary } from "./components/common/ErrorBoundary.jsx";
import { fisicoRoutes } from "./pages/fisico/routes.jsx";
import { gastosRoutes } from "./pages/gastos/routes.jsx";
import { ocioRoutes } from "./pages/ocio/routes.jsx";
import { proyectosRoutes } from "./pages/proyectos/routes.jsx";

export default function App() {
  const { pathname } = useLocation();
  // En pantalla grande la barra lateral (AppShell) reemplaza la barra de arriba y la de abajo.
  // Finanzas y Ocio usan todo el ancho (el Resumen de Finanzas, todo el alto); los demás módulos
  // mantienen su columna angosta.
  const wide = pathname.startsWith("/gastos") || pathname.startsWith("/ocio");
  const finanzasHome = pathname === "/gastos" || pathname === "/gastos/";
  const desktop = wide ? `lg:max-w-none lg:p-0 ${finanzasHome ? "lg:h-full" : ""}` : "lg:py-8";
  return (
    <div className="min-h-screen print:min-h-0" style={{ background: "var(--bg)" }}>
      <AppShell>
        {/* Al imprimir (informe en PDF) solo queda el contenido: sin barras, márgenes ni ancho máximo. */}
        <div className={`max-w-md mx-auto px-4 pt-6 pb-24 print:max-w-none print:p-0 ${desktop}`}>
          <div className="flex items-center justify-end gap-2 mb-2 print:hidden lg:hidden">
            <ExportButton />
            <ThemeToggle />
          </div>
          <ErrorBoundary resetKey={pathname}>
            <Routes>
              <Route path="/" element={<Navigate to="/fisico" replace />} />
              {fisicoRoutes}
              {gastosRoutes}
              {ocioRoutes}
              {proyectosRoutes}
              <Route path="*" element={<Navigate to="/fisico" replace />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </AppShell>
      <BottomNav className="lg:hidden" />
    </div>
  );
}
