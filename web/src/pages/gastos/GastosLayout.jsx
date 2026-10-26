import { useEffect, useMemo, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "../../components/common/ErrorBoundary.jsx";
import { useSidebarBadges } from "../../components/common/AppShell.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { installmentPlans } from "../../lib/installments.js";
import { todayDateInputValue } from "../../lib/format.js";
import { MODULES } from "../../modules.js";
import { FinanzasDataContext } from "./FinanzasData.jsx";

const ALL_ITEMS = MODULES.find((m) => m.id === "gastos").nav.flatMap((g) => g.items);

/** Celular: una sola fila de pestañas que se desliza, con la activa siempre a la vista. */
function TabStrip() {
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const strip = ref.current;
    const active = strip?.querySelector('[aria-current="page"]');
    if (!strip || !active) return;
    const target = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [pathname]);

  return (
    <nav className="lg:hidden print:hidden sticky top-0 z-10 -mx-4 mb-4 px-4" style={{ background: "var(--bg)" }} aria-label="Secciones de finanzas">
      <div ref={ref} className="no-scrollbar flex gap-5 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {ALL_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="flex items-center gap-1.5 py-2.5 text-xs font-semibold whitespace-nowrap shrink-0 -mb-px"
            style={({ isActive }) => ({
              color: isActive ? "var(--accent-strong)" : "var(--text-faint)",
              borderBottom: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
            })}
          >
            <item.icon size={14} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Finanzas: carga los gastos una vez (los comparten el Resumen y el badge de Cuotas) y da el marco de sus páginas. */
export function GastosLayout() {
  const { pathname } = useLocation();
  const home = pathname === "/gastos" || pathname === "/gastos/";
  const expensesApi = useApi(api.getExpenses, []);

  // Al volver al Resumen se recargan los gastos: Importar, Cuotas o el Informe pueden haberlos cambiado.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (home) expensesApi.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home]);

  const expenses = expensesApi.data;
  const installments = useMemo(() => (expenses ? installmentPlans(expenses, todayDateInputValue()).filter((p) => !p.done).length : 0), [expenses]);
  useSidebarBadges({ installments });
  const data = useMemo(() => ({ expenses, setExpenses: expensesApi.setData, reload: expensesApi.reload }), [expenses, expensesApi.setData, expensesApi.reload]);

  return (
    <FinanzasDataContext.Provider value={data}>
      {/* Escritorio: el Resumen ocupa todo el alto (scrollean sus paneles); las demás páginas llevan márgenes. */}
      <div className={`gastos-layout ${home ? "lg:h-full" : "lg:px-8 lg:py-6"}`}>
        <TabStrip />
        <div className={home ? "lg:h-full" : "lg:max-w-[80rem] lg:mx-auto"}>
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </FinanzasDataContext.Provider>
  );
}
