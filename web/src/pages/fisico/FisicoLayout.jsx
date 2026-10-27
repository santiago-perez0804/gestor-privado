import { useCallback, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "../../components/common/ErrorBoundary.jsx";
import { ModuleTabStrip } from "../../components/common/ModuleTabStrip.jsx";
import { useSidebarBadges } from "../../components/common/AppShell.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { FisicoContext } from "./FisicoContext.jsx";

// Pantallas ya rediseñadas (ocupan todo el ancho); el resto conserva la columna angosta de antes.
const REDESIGNED = ["/fisico/plan"];
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
  return (
    <FisicoContext.Provider value={value}>
      <div className="fisico-layout">
        <ModuleTabStrip moduleId="fisico" />
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
