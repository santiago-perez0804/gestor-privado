import { useEffect, useMemo, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "../../components/common/ErrorBoundary.jsx";
import { useSidebarBadges } from "../../components/common/AppShell.jsx";
import { ModuleTabStrip } from "../../components/common/ModuleTabStrip.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { installmentPlans } from "../../lib/installments.js";
import { todayDateInputValue } from "../../lib/format.js";
import { FinanzasDataContext } from "./FinanzasData.jsx";

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
        <ModuleTabStrip moduleId="gastos" />
        <div className={home ? "lg:h-full" : "lg:max-w-[80rem] lg:mx-auto"}>
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </FinanzasDataContext.Provider>
  );
}
