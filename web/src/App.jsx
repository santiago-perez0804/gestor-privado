import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/common/AppShell.jsx";
import { BottomNav } from "./components/common/BottomNav.jsx";
import { ThemeToggle } from "./components/common/ThemeToggle.jsx";
import { ExportButton } from "./components/common/ExportButton.jsx";
import { LogoutButton } from "./components/common/LogoutButton.jsx";
import { ErrorBoundary } from "./components/common/ErrorBoundary.jsx";
import { fisicoRoutes } from "./pages/fisico/routes.jsx";
import { gastosRoutes } from "./pages/gastos/routes.jsx";
import { ocioRoutes } from "./pages/ocio/routes.jsx";
import { proyectosRoutes } from "./pages/proyectos/routes.jsx";
import { ModoMuseo } from "./pages/ocio/ModoMuseo.jsx";
import { Entreno } from "./pages/fisico/Entreno.jsx";

export default function App() {
  const { pathname } = useLocation();
  // Modo museo: pantalla completa sin el marco de la app (también sirve como widget de escritorio).
  // Entreno en vivo: también a pantalla completa (es la pantalla del celular en el gym).
  if (pathname === "/museo" || pathname === "/fisico/entreno")
    return (
      <ErrorBoundary resetKey={pathname}>
        <Routes>
          <Route path="/museo" element={<ModoMuseo />} />
          <Route path="/fisico/entreno" element={<Entreno />} />
        </Routes>
      </ErrorBoundary>
    );
  // En pantalla grande la barra lateral (AppShell) reemplaza la barra de arriba y la de abajo.
  // Finanzas y Ocio usan todo el ancho (el Resumen de Finanzas, todo el alto); los demás módulos
  // mantienen su columna angosta.
  const wide = pathname.startsWith("/gastos") || pathname.startsWith("/ocio") || pathname.startsWith("/fisico");
  const finanzasHome = pathname === "/gastos" || pathname === "/gastos/";
  // Plan y rutinas: alto fijo (solo scrollean la lista de rutinas y la de ejercicios).
  const planPage = /^\/fisico\/plan(\/|$)/.test(pathname);
  const desktop = wide ? `lg:max-w-none lg:p-0 ${finanzasHome ? "lg:h-full" : planPage ? "fit:h-full" : ""}` : "lg:py-8";
  return (
    <div className="min-h-screen print:min-h-0" style={{ background: "var(--bg)" }}>
      <AppShell>
        {/* Al imprimir (informe en PDF) solo queda el contenido: sin barras, márgenes ni ancho máximo. */}
        <div className={`max-w-md mx-auto px-4 pt-6 pb-24 print:max-w-none print:p-0 ${desktop}`}>
          <div className="flex items-center justify-end gap-2 mb-2 print:hidden lg:hidden">
            <ExportButton />
            <ThemeToggle />
            <LogoutButton />
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
