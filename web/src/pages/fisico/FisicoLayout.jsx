import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Play } from "lucide-react";
import { ErrorBoundary } from "../../components/common/ErrorBoundary.jsx";
import { ModuleTabStrip } from "../../components/common/ModuleTabStrip.jsx";
import { useSidebarBadges } from "../../components/common/AppShell.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { FisicoContext } from "./FisicoContext.jsx";
import { localInProgress } from "../../lib/fisico/workoutDevice.js";
import { flushFinishedWorkout } from "./Entreno.jsx";

// Pantallas ya rediseñadas (ocupan todo el ancho); el resto conserva la columna angosta de antes.
const REDESIGNED = ["/fisico/plan", "/fisico/records"];
const isRedesigned = (path) => REDESIGNED.some((p) => path === p || path.startsWith(`${p}/`));

/** "PPL" → "PPL"; "Fuerza 5×5" → "FUERZ": la etiqueta corta del plan activo en la barra lateral. */
export const planTag = (name) => (name ? (name.length <= 5 ? name : name.split(/\s+/)[0].slice(0, 5)).toUpperCase() : "");

/** Marco de Físico: pestañas en el celular, el plan activo en la barra lateral y el contexto compartido. */
export function FisicoLayout() {
  const { pathname } = useLocation();
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const settingsApi = useApi(() => api.getFisicoSettings(), [version]);
  const plansApi = useApi(() => api.getFisicoPlans(), [version]);
  const active = plansApi.data?.find((p) => p.isActive);
  useSidebarBadges(active ? { plan: planTag(active.name) } : {});

  const value = useMemo(() => ({ version, bump, settings: settingsApi.data }), [version, bump, settingsApi.data]);
  // Un entreno en curso en este celular: acceso directo para volver. Uno terminado sin subir: se sube.
  const [running, setRunning] = useState(null);
  useEffect(() => {
    setRunning(localInProgress());
    flushFinishedWorkout()
      .then((uploaded) => uploaded && bump())
      .catch(() => {});
  }, [pathname, bump]);
  return (
    <FisicoContext.Provider value={value}>
      <div className="fisico-layout">
        <ModuleTabStrip moduleId="fisico" />
        {running && (
          <Link to="/fisico/entreno" className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4 lg:m-4 text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Play size={16} /> Volver al entreno: {running.title}
          </Link>
        )}
        <ErrorBoundary resetKey={pathname}>
          {isRedesigned(pathname) ? (
            <Outlet />
          ) : (
            <div className="lg:max-w-md lg:mx-auto lg:py-8">
              <Outlet />
            </div>
          )}
        </ErrorBoundary>
      </div>
    </FisicoContext.Provider>
  );
}
