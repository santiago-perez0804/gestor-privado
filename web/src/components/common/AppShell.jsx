import { createContext, useContext, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Moon, Settings, Sun } from "lucide-react";
import { ExportButton } from "./ExportButton.jsx";
import { ModuleSwitcher } from "./ModuleSwitcher.jsx";
import { useTheme } from "../../hooks/useTheme.js";
import { moduleForPath } from "../../modules.js";

const EASE = [0.16, 1, 0.3, 1];

// Números chicos al lado de una sección (p. ej. cuántas compras en cuotas hay). Cada módulo los publica.
const SidebarBadgesContext = createContext(() => {});

/** Publica los badges de la barra lateral mientras el componente está montado. */
export function useSidebarBadges(badges) {
  const setBadges = useContext(SidebarBadgesContext);
  const key = JSON.stringify(badges);
  useEffect(() => {
    setBadges(JSON.parse(key));
    return () => setBadges({});
  }, [key, setBadges]);
}

const footerButton = "flex items-center justify-center rounded-lg shrink-0";
const footerButtonStyle = { width: 32, height: 32, color: "var(--text-muted)", border: "1px solid var(--border)" };

function SidebarFooter() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  // La ventana de Configuración solo existe en la app de escritorio.
  const openSettings = typeof window !== "undefined" ? window.gestorDesktop?.openSettings : undefined;
  return (
    <div className="flex items-center gap-1.5 p-3" style={{ borderTop: "1px solid var(--border)" }}>
      <button onClick={toggleTheme} className="hover-surface flex-1 min-w-0 flex items-center justify-between px-2.5 h-8 text-xs" style={{ color: "var(--text-muted)" }} aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}>
        <span className="truncate">{dark ? "Tema oscuro" : "Tema claro"}</span>
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <ExportButton />
      {openSettings && (
        <button onClick={() => openSettings()} className={`hover-surface ${footerButton}`} style={footerButtonStyle} aria-label="Configuración" title="Configuración">
          <Settings size={15} />
        </button>
      )}
    </div>
  );
}

function SidebarNav({ module, badges }) {
  return (
    <nav className="thin-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 pb-3" aria-label={`Secciones de ${module.label}`}>
      {/* Al cambiar de módulo, las secciones se reemplazan con un fundido y un desliz corto. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={module.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="flex flex-col gap-5"
        >
          {module.nav.map((group, gi) => (
            <div key={group.label ?? gi}>
              {group.label && (
                <p className="px-2.5 mb-1.5 mt-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  {group.label}
                </p>
              )}
              <div className={`flex flex-col gap-0.5 ${group.label ? "" : "mt-2"}`}>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className="sidebar-link flex items-center gap-2.5 rounded-lg px-2.5 h-9 text-[13px]"
                    style={({ isActive }) => ({
                      color: isActive ? "var(--text)" : "var(--text-muted)",
                      background: isActive ? "var(--accent-soft)" : undefined,
                      fontWeight: isActive ? 600 : 500,
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon size={16} style={{ color: item.color ?? (isActive ? "var(--accent)" : undefined) }} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (typeof badges[item.badge] === "string" ? !!badges[item.badge] : badges[item.badge] > 0) && (
                          <span className="text-[10px] font-mono font-semibold rounded-md px-1.5 py-0.5" style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}>
                            {badges[item.badge]}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          {module.cta && (
            <Link to={module.cta.to} className="flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              <module.cta.icon size={15} />
              {module.cta.label}
            </Link>
          )}
        </motion.div>
      </AnimatePresence>
    </nav>
  );
}

/**
 * Escritorio (≥1024px): barra lateral fija a todo el alto (módulo, secciones, tema, exportar y
 * configuración) y el contenido con su propio scroll, así la ventana nunca scrollea.
 * Celular: no agrega nada (se navega con la barra de abajo). Al imprimir vuelve al flujo normal.
 */
export function AppShell({ children }) {
  const { pathname } = useLocation();
  const module = moduleForPath(pathname);
  const [badges, setBadges] = useState({});

  return (
    <SidebarBadgesContext.Provider value={setBadges}>
      <MotionConfig reducedMotion="user">
        <div className="lg:flex lg:h-dvh print:!block print:!h-auto">
          <aside className="hidden lg:flex print:!hidden flex-col w-56 xl:w-60 shrink-0 h-full" style={{ borderRight: "1px solid var(--border)" }}>
            <div className="p-3">
              <ModuleSwitcher currentId={module.id} />
            </div>
            <SidebarNav module={module} badges={badges} />
            <SidebarFooter />
          </aside>
          <div className="thin-scroll min-w-0 lg:flex-1 lg:h-full lg:overflow-y-auto print:!h-auto print:!overflow-visible">{children}</div>
        </div>
      </MotionConfig>
    </SidebarBadgesContext.Provider>
  );
}
