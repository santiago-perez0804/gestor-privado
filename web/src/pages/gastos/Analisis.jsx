import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, BarChart3, FileText, Lightbulb, Minus, Percent, Scale, Table2 } from "lucide-react";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { IncomeExpenseChart } from "../../components/expenses/IncomeExpenseChart.jsx";
import { InsightCard } from "../../components/expenses/InsightCard.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { getBillingMonth, monthlyTotalByCategory, MONTHS_ES_ABBR } from "../../lib/billing.js";
import { categoryLabel, categoryColorVar } from "../../lib/expenseCategories.js";
import { currency, todayDateInputValue } from "../../lib/format.js";
import {
  monthlySeries,
  monthlyIncome,
  needsWants,
  categoryVsAverage,
  inflationFromSettings,
  inflationSource,
  INFLATION_SETTING_KEY,
  INFLATION_AUTO_MONTH_KEY,
} from "../../lib/finance.js";
import { buildInsights } from "../../lib/insights.js";

function Toggle({ value, onChange, options }) {
  return (
    <div className="flex rounded-full p-0.5" style={{ background: "var(--surface-alt)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            background: value === o.value ? "var(--surface)" : "transparent",
            color: value === o.value ? "var(--accent-strong)" : "var(--text-muted)",
            boxShadow: value === o.value ? "var(--shadow-sm)" : "none",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RuleRow({ label, hint, value, target, max }) {
  // max = true → el objetivo es un techo (necesidades/deseos); false → un piso (ahorro).
  const ok = max ? value <= target : value >= target;
  const width = Math.min(1, Math.max(0, value));
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm min-w-0">
          {label}
          <span className="block text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
            {hint}
          </span>
        </span>
        <span className="text-xs font-mono tabular-nums flex items-center gap-1">
          {Math.round(value * 100)}%
          <span style={{ color: ok ? "var(--status-good)" : "var(--status-warning)" }}>{ok ? "✓" : "!"}</span>
          <span style={{ color: "var(--text-faint)" }}>
            / {max ? "≤" : "≥"}
            {Math.round(target * 100)}%
          </span>
        </span>
      </div>
      <div className="relative rounded-full" style={{ height: 8, background: "var(--surface-alt)" }}>
        <div className="h-full rounded-full" style={{ width: `${width * 100}%`, background: ok ? "var(--accent)" : "var(--status-warning)", transition: "width 0.4s" }} />
        <span className="absolute -top-1 -bottom-1 rounded-full" style={{ left: `calc(${target * 100}% - 1px)`, width: 2, background: "var(--text-muted)" }} title={`Referencia ${Math.round(target * 100)}%`} />
      </div>
    </div>
  );
}

/** Inflación mensual: por defecto el último dato del INDEC; se puede fijar a mano (vacío = volver al INDEC). */
function InflationEditor({ value, source, monthLabel, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  if (!editing)
    return (
      <button
        onClick={() => setEditing(true)}
        title={source === "indec" ? `Último dato del INDEC (${monthLabel}). Tocá para fijarla a mano.` : source === "manual" ? "Fijada a mano. Tocá para cambiarla o dejala vacía para volver al INDEC." : "Valor por defecto"}
        className="text-xs font-semibold rounded-full px-2.5 py-1 flex items-center gap-1"
        style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}
      >
        <Percent size={11} />
        Inflación {value}%/mes{source === "indec" ? " · INDEC" : source === "manual" ? " · manual" : ""}
      </button>
    );
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const raw = draft.trim();
        if (!raw) onSave(null);
        else {
          const v = parseFloat(raw.replace(",", "."));
          if (Number.isFinite(v) && v >= 0 && v < 50) onSave(v);
        }
        setEditing(false);
      }}
    >
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="INDEC" className="w-14 rounded-md px-2 py-1 text-xs font-mono" />
      <span className="text-xs">%/mes</span>
    </form>
  );
}

export function Analisis() {
  const data = useApi(
    () =>
      Promise.all([
        api.getExpenses(),
        api.getIncomes(),
        api.getBudgets(),
        api.getRecurringExpenses(),
        api.getSavingsGoals(),
        api.getSettings(),
        api.getExchangeRates().catch(() => null),
      ]),
    []
  );
  const [real, setReal] = useState(false);
  const [showTable, setShowTable] = useState(false);

  if (!data.data) return null;
  const [expenses, incomes, budgets, recurring, goals, settings, rates] = data.data;
  const inflationPct = inflationFromSettings(settings);
  const autoMonth = settings[INFLATION_AUTO_MONTH_KEY];
  const autoMonthLabel = autoMonth ? `${MONTHS_ES_ABBR[parseInt(autoMonth.slice(5, 7), 10) - 1]} ${autoMonth.slice(0, 4)}` : "";
  const today = todayDateInputValue();
  const bm = getBillingMonth(today);
  const series = monthlySeries(expenses, incomes, bm, 6, { inflationPct, real });
  const income = monthlyIncome(incomes, bm);
  const totals = monthlyTotalByCategory(expenses, bm);
  const { needs, wants } = needsWants(totals);
  const spent = needs + wants;
  const comparison = categoryVsAverage(expenses, bm, 3, inflationPct).filter((c) => c.current > 0 || c.average > 0);
  const insights = buildInsights({ expenses, incomes, budgets, recurring, goals, inflationPct, today, rates });

  async function saveInflation(v) {
    if (v == null) await api.deleteSetting(INFLATION_SETTING_KEY);
    else await api.setSetting(INFLATION_SETTING_KEY, v);
    const fresh = await api.getSettings();
    data.setData((prev) => prev.map((x, i) => (i === 5 ? fresh : x)));
  }

  return (
    <PageTransition>
      <PageHeader title="Análisis" subtitle="Comparaciones, ahorro y consejos" action={<InflationEditor key={inflationPct} value={inflationPct} source={inflationSource(settings)} monthLabel={autoMonthLabel} onSave={saveInflation} />} />
      <div className="grid gap-4 items-start lg:grid-cols-2 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <SectionHeading
            icon={BarChart3}
            action={
              <Toggle
                value={real ? "real" : "nominal"}
                onChange={(v) => setReal(v === "real")}
                options={[
                  { value: "nominal", label: "Nominal" },
                  { value: "real", label: "Pesos de hoy" },
                ]}
              />
            }
          >
            Ingresos vs gastos
          </SectionHeading>
          <IncomeExpenseChart series={series} />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              {real ? `Meses anteriores ajustados a ${inflationPct}% mensual.` : "Montos tal como se cargaron."} Período = cierre de tarjeta.
            </p>
            <button onClick={() => setShowTable((v) => !v)} className="ghost-action flex items-center gap-1 text-[11px] font-semibold shrink-0 px-2 py-1 -mr-2" style={{ color: "var(--accent-strong)" }}>
              <Table2 size={12} />
              {showTable ? "Ocultar tabla" : "Ver tabla"}
            </button>
          </div>
          {showTable && (
            <table className="w-full text-xs mt-2 font-mono tabular-nums">
              <thead>
                <tr style={{ color: "var(--text-faint)" }}>
                  <th className="text-left font-medium py-1">Período</th>
                  <th className="text-right font-medium">Ingresos</th>
                  <th className="text-right font-medium">Gastos</th>
                  <th className="text-right font-medium">Ahorro</th>
                  <th className="text-right font-medium">Tasa</th>
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().map((m) => (
                  <tr key={`${m.billingMonth.year}-${m.billingMonth.month}`} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="py-1 font-sans">
                      {MONTHS_ES_ABBR[m.billingMonth.month]} {String(m.billingMonth.year).slice(2)}
                    </td>
                    <td className="text-right">{currency.format(m.income)}</td>
                    <td className="text-right">{currency.format(m.spent)}</td>
                    <td className="text-right" style={{ color: m.saved < 0 ? "var(--danger)" : undefined }}>
                      {m.income > 0 ? currency.format(m.saved) : "—"}
                    </td>
                    <td className="text-right">{m.rate != null ? `${Math.round(m.rate * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <SectionHeading
            icon={Lightbulb}
            action={
              <Link to="/gastos/informe" className="flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1" style={{ color: "var(--accent-strong)", background: "var(--accent-soft)" }}>
                <FileText size={12} />
                Informe mensual
              </Link>
            }
          >
            Consejos para vos
          </SectionHeading>
          <div className="flex flex-col gap-2">
            {insights.map((ins) => (
              <InsightCard key={ins.id} insight={ins} />
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeading icon={Scale}>Regla 50/30/20</SectionHeading>
          {income > 0 ? (
            <div className="flex flex-col gap-3">
              <RuleRow label="Necesidades" hint="comida, transporte, servicios, salud, hogar" value={needs / income} target={0.5} max />
              <RuleRow label="Deseos" hint="ocio, ropa, otros" value={wants / income} target={0.3} max />
              <RuleRow label="Ahorro" hint="lo que no gastaste" value={Math.max(0, (income - spent) / income)} target={0.2} />
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                Método de Elizabeth Warren: con el ingreso neto, hasta 50% a necesidades, 30% a gustos y al menos 20% a ahorro o deudas. Es una referencia, no una ley: con alquiler alto, lo realista puede ser 60/20/20.
              </p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Cargá tus ingresos de este período para ver cómo se reparte tu plata.
            </p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeading icon={BarChart3}>Por categoría vs promedio de 3 meses</SectionHeading>
          <div className="flex flex-col">
            {comparison.map((c) => {
              const up = c.delta != null && c.delta > 0.05;
              const down = c.delta != null && c.delta < -0.05;
              const ArrowIcon = up ? ArrowUp : down ? ArrowDown : Minus;
              return (
                <div key={c.category} className="flex items-center gap-2 py-2 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, background: `var(${categoryColorVar(c.category)})` }} />
                  <span className="flex-1 truncate">{categoryLabel(c.category)}</span>
                  <span className="font-mono text-xs tabular-nums" style={{ color: "var(--text-faint)" }}>
                    {c.average == null ? "sin historial" : `prom. ${currency.format(c.average)}`}
                  </span>
                  <span className="font-mono text-xs tabular-nums w-20 text-right">{currency.format(c.current)}</span>
                  <span
                    className="flex items-center justify-end gap-0.5 text-[11px] font-mono font-semibold w-14"
                    style={{ color: up ? "var(--status-warning)" : down ? "var(--status-good)" : "var(--text-faint)" }}
                    title={up ? "Más que tu promedio" : down ? "Menos que tu promedio" : "Similar a tu promedio"}
                  >
                    <ArrowIcon size={11} />
                    {c.delta == null ? "nuevo" : c.historyMonths < 2 ? "~" : `${Math.abs(Math.round(c.delta * 100))}%`}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
            El promedio usa hasta 3 períodos anteriores con datos, llevados a pesos de hoy para que la inflación no infle la comparación. Con menos de 2 períodos de historial el % no es confiable (se muestra "~"). Ojo: el período actual todavía no terminó.
          </p>
        </Card>
      </div>
    </PageTransition>
  );
}
