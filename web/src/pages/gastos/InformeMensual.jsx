import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCheck, ClipboardCheck, Download, Loader2, Percent, Trash2 } from "lucide-react";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { ReportDocument } from "../../components/report/ReportDocument.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { billingMonthKey, billingMonthDiff, getBillingMonth, MONTHS_ES } from "../../lib/billing.js";
import { EXPENSE_CATEGORIES, categoryLabel } from "../../lib/expenseCategories.js";
import { MERCHANT_TYPES, merchantTypeLabel } from "../../lib/merchants.js";
import { inflationFromSettings } from "../../lib/finance.js";
import { currency, formatShortDate, todayDateInputValue } from "../../lib/format.js";
import { buildMonthlyReport, availablePeriods, defaultReportPeriod, kioskMarkupFromSettings, KIOSK_MARKUP_SETTING_KEY } from "../../lib/monthlyReport.js";
import { exportPdf } from "../../lib/exportPdf.js";

const parseKey = (key) => {
  const [y, m] = (key || "").split("-").map(Number);
  return y && m >= 1 && m <= 12 ? { year: y, month: m - 1 } : null;
};

const selectClass = "rounded-lg px-2 py-1.5 text-xs";

/** Gastos del período con algo para completar o revisar antes de exportar. */
function ReviewPanel({ report, onUpdate, onDelete }) {
  const [busy, setBusy] = useState(false);
  const { quality: q } = report;
  const dupIds = new Set(q.duplicates.flat().map((e) => e.id));
  const suspicious = new Map(q.suspicious.map((s) => [s.expense.id, s.guess]));
  const rows = report.purchases.filter((p) => !p.merchantType || !p.category || p.category === "otros" || suspicious.has(p.id) || dupIds.has(p.id));
  const suggestions = rows.filter((p) => !p.merchantType && p.merchant);

  async function applyAll() {
    setBusy(true);
    try {
      for (const p of suggestions) await onUpdate(p.id, { merchantType: p.merchant });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padded={false} className="print:hidden">
      <div className="px-5 pt-5">
        <SectionHeading
          icon={ClipboardCheck}
          action={
            suggestions.length > 0 && (
              <button
                onClick={applyAll}
                disabled={busy}
                className="flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1"
                style={{ color: "var(--accent-strong)", background: "var(--accent-soft)" }}
                title="Guarda el comercio sugerido en cada gasto que no lo tiene"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                Aplicar {suggestions.length} {suggestions.length === 1 ? "sugerencia" : "sugerencias"}
              </button>
            )
          }
        >
          Revisar el mes antes de exportar
        </SectionHeading>
        <p className="text-xs pb-3" style={{ color: "var(--text-muted)" }}>
          {rows.length === 0
            ? "Todo completo: categorías, comercios y sin duplicados a la vista."
            : `Datos completos al ${q.score}%. Completá el comercio y la categoría de estos gastos: el informe (y los próximos) se vuelven más precisos, y la app aprende para la próxima vez.`}
        </p>
      </div>
      {rows.length > 0 && (
        <div className="thin-scroll max-h-[22rem] overflow-y-auto" style={{ borderTop: "1px solid var(--border)" }}>
          {rows.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5 text-sm" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate">
                  <span className="font-mono text-xs mr-1.5" style={{ color: "var(--text-faint)" }}>
                    {formatShortDate(p.date)}
                  </span>
                  {p.title}
                  <span className="font-mono text-xs ml-1.5" style={{ color: "var(--text-muted)" }}>
                    {currency.format(p.amount)}
                  </span>
                </p>
                {p.description && (
                  <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
                    {p.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {dupIds.has(p.id) && <Reason tone="var(--status-critical)">Posible duplicado</Reason>}
                  {suspicious.has(p.id) && <Reason tone="var(--status-warning)">¿{categoryLabel(suspicious.get(p.id))}?</Reason>}
                  {(!p.category || p.category === "otros") && <Reason tone="var(--status-warning)">{p.category ? "En Otros" : "Sin categoría"}</Reason>}
                  {!p.merchantType && <Reason tone="var(--text-faint)">Sin comercio</Reason>}
                </div>
              </div>
              <select value={p.category || ""} onChange={(e) => onUpdate(p.id, { category: e.target.value || null })} className={selectClass} aria-label="Categoría">
                <option value="">Sin categoría</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select value={p.merchantType || ""} onChange={(e) => onUpdate(p.id, { merchantType: e.target.value || null })} className={selectClass} aria-label="Comercio">
                <option value="">{p.merchant ? `Sugerido: ${merchantTypeLabel(p.merchant)}` : "Comercio…"}</option>
                {MERCHANT_TYPES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {!p.merchantType && p.merchant && (
                <button onClick={() => onUpdate(p.id, { merchantType: p.merchant })} className="ghost-action text-xs font-semibold px-2 py-1" style={{ color: "var(--accent-strong)" }} title="Guardar el comercio sugerido">
                  Aceptar
                </button>
              )}
              {dupIds.has(p.id) && (
                <button
                  onClick={() => window.confirm(`¿Borrar “${p.title}” (${currency.format(p.amount)})? No se puede deshacer.`) && onDelete(p.id)}
                  className="ghost-action flex items-center gap-1 text-xs font-semibold px-2 py-1"
                  style={{ color: "var(--danger)" }}
                >
                  <Trash2 size={12} />
                  Borrar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Reason({ tone, children }) {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }}>
      {children}
    </span>
  );
}

function MarkupEditor({ value, onSave }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const v = parseFloat(draft.replace(",", "."));
    if (Number.isFinite(v) && v >= 0 && v <= 200 && v !== value) onSave(v);
    else setDraft(String(value));
  };
  return (
    <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }} title="Cuánto más caro estimás que es el kiosco que el súper para lo mismo">
      <Percent size={12} />
      Sobreprecio kiosco
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        inputMode="decimal"
        className="w-12 rounded-md px-1.5 py-1 text-xs font-mono text-right"
      />
      %
    </label>
  );
}

export function InformeMensual() {
  const [params, setParams] = useSearchParams();
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);
  const data = useApi(
    () => Promise.all([api.getExpenses(), api.getIncomes(), api.getBudgets(), api.getRecurringExpenses(), api.getSettings(), api.getExchangeRates().catch(() => null)]),
    []
  );

  if (!data.data) return null;
  const [expenses, incomes, budgets, recurring, settings, rates] = data.data;
  const today = todayDateInputValue();
  const current = getBillingMonth(today);
  const periods = availablePeriods(expenses, today);
  const bm = parseKey(params.get("periodo")) ?? defaultReportPeriod(today);
  const key = billingMonthKey(bm);
  const kioskMarkupPct = kioskMarkupFromSettings(settings);
  const report = buildMonthlyReport({ expenses, incomes, budgets, recurring, rates, bm, today, inflationPct: inflationFromSettings(settings), kioskMarkupPct });

  const setAt = (index, value) => data.setData((prev) => prev.map((x, i) => (i === index ? value : x)));

  async function updateExpense(id, patch) {
    const updated = await api.updateExpense(id, patch);
    data.setData((prev) => prev.map((x, i) => (i === 0 ? x.map((e) => (e.id === id ? updated : e)) : x)));
  }

  async function deleteExpense(id) {
    await api.deleteExpense(id);
    data.setData((prev) => prev.map((x, i) => (i === 0 ? x.filter((e) => e.id !== id) : x)));
  }

  async function saveMarkup(v) {
    await api.setSetting(KIOSK_MARKUP_SETTING_KEY, v);
    setAt(4, { ...settings, [KIOSK_MARKUP_SETTING_KEY]: String(v) });
  }

  async function handleExport() {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await exportPdf(`Analisis-gastos-${key}`);
      if (res?.saved) setExportMsg(`Guardado en ${res.saved}`);
    } catch (err) {
      setExportMsg(`No se pudo exportar (${err.message}).`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageTransition>
      <div className="print:hidden">
        <PageHeader
          title="Informe mensual"
          subtitle="Análisis del período para revisar y exportar en PDF"
          action={
            <button onClick={handleExport} disabled={exporting} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shrink-0" style={{ background: "var(--accent)", color: "#fff" }}>
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Descargar PDF
            </button>
          }
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            Período
            <select value={key} onChange={(e) => setParams({ periodo: e.target.value })} className={`${selectClass} capitalize`}>
              {periods.map((p) => (
                <option key={billingMonthKey(p)} value={billingMonthKey(p)}>
                  {MONTHS_ES[p.month]} {p.year}
                  {billingMonthDiff(p, current) === 0 ? " (en curso)" : ""}
                </option>
              ))}
            </select>
          </label>
          <MarkupEditor key={kioskMarkupPct} value={kioskMarkupPct} onSave={saveMarkup} />
          {exportMsg && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {exportMsg}
            </span>
          )}
        </div>
        <div className="mb-4">
          <ReviewPanel report={report} onUpdate={updateExpense} onDelete={deleteExpense} />
        </div>
      </div>
      <ReportDocument report={report} generatedAt={new Date().toLocaleDateString("es-AR")} />
    </PageTransition>
  );
}
