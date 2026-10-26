import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { QuickExpenseForm } from "../../components/expenses/QuickExpenseForm.jsx";
import { PeriodHeader } from "../../components/expenses/resumen/PeriodHeader.jsx";
import { KpiStrip } from "../../components/expenses/resumen/KpiStrip.jsx";
import { AlertBanner, DISMISSED_ALERTS_SETTING_KEY, parseDismissed, withDismissed } from "../../components/expenses/resumen/AlertBanner.jsx";
import { MovementsList } from "../../components/expenses/resumen/MovementsList.jsx";
import { InstallmentsPanel } from "../../components/expenses/resumen/InstallmentsPanel.jsx";
import { buildInsights } from "../../lib/insights.js";
import { inflationFromSettings } from "../../lib/finance.js";
import { availablePeriods } from "../../lib/monthlyReport.js";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { getBillingMonth, billingMonthDiff, billingMonthKey, parseBillingMonthKey } from "../../lib/billing.js";
import { todayDateInputValue } from "../../lib/format.js";
import { useFinanzasData } from "./FinanzasData.jsx";

// Avisos que van en el banner: solo los de alerta. Los informativos quedan en Análisis.
const BANNER_TONES = new Set(["warn", "bad"]);

export function GastosHome() {
  const { expenses, setExpenses } = useFinanzasData();
  // Contexto para el balance, la meta y los avisos (no bloquea el resto de la pantalla).
  const contextApi = useApi(
    () =>
      Promise.all([
        api.getIncomes(),
        api.getBudgets(),
        api.getRecurringExpenses(),
        api.getSavingsGoals(),
        api.getSettings(),
        api.getExchangeRates().catch(() => null),
      ]),
    []
  );
  const [params, setParams] = useSearchParams();
  const today = todayDateInputValue();
  const current = getBillingMonth(today);
  const requested = parseBillingMonthKey(params.get("periodo"));
  const bm = requested && billingMonthDiff(current, requested) >= 0 ? requested : current;
  const isCurrent = billingMonthDiff(current, bm) === 0;
  const [incomes = [], budgets = [], recurring = [], goals = [], settings = {}, rates = null] = contextApi.data || [];

  const periods = useMemo(() => (expenses ? availablePeriods(expenses, today) : [current]), [expenses, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const oldest = periods[periods.length - 1];

  const alerts = useMemo(() => {
    if (!expenses || !contextApi.data || !isCurrent) return [];
    const dismissed = parseDismissed(settings);
    const key = billingMonthKey(bm);
    return buildInsights({ expenses, incomes, budgets, recurring, goals, inflationPct: inflationFromSettings(settings), today, rates }).filter(
      (i) => BANNER_TONES.has(i.tone) && !dismissed.has(`${i.id}|${key}`)
    );
  }, [expenses, contextApi.data, isCurrent, bm, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!expenses) return null;

  function goTo(next) {
    setParams(billingMonthDiff(current, next) === 0 ? {} : { periodo: billingMonthKey(next) }, { replace: true });
  }

  function setSetting(key, value) {
    contextApi.setData((prev) => prev && prev.map((x, i) => (i === 4 ? { ...x, [key]: value } : x)));
  }

  async function dismissAlert(id) {
    const value = JSON.stringify(withDismissed(parseDismissed(settings), id, billingMonthKey(bm)));
    setSetting(DISMISSED_ALERTS_SETTING_KEY, value);
    await api.setSetting(DISMISSED_ALERTS_SETTING_KEY, value);
  }

  async function handleAdd(data) {
    const created = await api.addExpense(data);
    setExpenses((prev) => [created, ...(prev || [])]);
  }

  async function handleUpdate(id, data) {
    const updated = await api.updateExpense(id, data);
    setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
  }

  async function handleDelete(id) {
    await api.deleteExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <PageTransition className="lg:h-full">
      {/* Celular: una columna (los `contents` dejan que el orden lo decida cada bloque).
          Escritorio: encabezado arriba, panel de carga a la izquierda y el período a la derecha; solo scrollean los paneles. */}
      <div className="flex flex-col gap-4 lg:gap-0 lg:h-full">
        <PeriodHeader bm={bm} current={current} oldest={oldest} today={today} onChange={goTo} />
        <div className="flex flex-col gap-4 lg:gap-0 lg:flex-1 lg:min-h-0 lg:grid lg:grid-cols-[23rem_minmax(0,1fr)] xl:grid-cols-[25rem_minmax(0,1fr)]">
          {/* El formulario queda fijo y solo scrollean las cuotas. Si la ventana es muy baja para ambos,
              scrollea la columna entera antes que aplastar las cuotas. */}
          <aside className="contents lg:flex lg:flex-col lg:min-h-0 lg:overflow-y-auto thin-scroll lg:border-r" aria-label="Cargar gastos y cuotas">
            <div className="order-3 lg:order-none lg:shrink-0">
              <QuickExpenseForm onAdd={handleAdd} expenses={expenses} />
            </div>
            <div className="order-4 lg:order-none lg:flex-1 lg:min-h-[15rem] lg:flex lg:flex-col">
              <InstallmentsPanel expenses={expenses} today={today} />
            </div>
          </aside>
          <div className="contents lg:flex lg:flex-col lg:min-h-0 lg:min-w-0">
            <div className="order-1 lg:order-none">
              <KpiStrip expenses={expenses} incomes={incomes} settings={settings} bm={bm} current={current} today={today} onSettingChange={setSetting} />
            </div>
            {alerts.length > 0 && (
              <div className="order-2 lg:order-none">
                <AlertBanner alerts={alerts} onDismiss={dismissAlert} />
              </div>
            )}
            <div className="order-5 lg:order-none lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
              <MovementsList expenses={expenses} bm={bm} onUpdate={handleUpdate} onDelete={handleDelete} />
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
