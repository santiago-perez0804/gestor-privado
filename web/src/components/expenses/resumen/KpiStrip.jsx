import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Pencil, X } from "lucide-react";
import { api } from "../../../lib/api.js";
import { currency } from "../../../lib/format.js";
import { billingMonthDiff, billingPeriodProgress, monthlyTotal, monthlyTotalByPaymentMethod } from "../../../lib/billing.js";
import { monthlyIncome, spendingLimitFromSettings, spendingLimitStatus, SPENDING_LIMIT_SETTING_KEY } from "../../../lib/finance.js";

const money = (x) => currency.format(Math.round(x));
const pct = (x) => `${Math.round(x * 100)}%`;
const STATUS_COLOR = { good: "var(--accent)", ahead: "var(--status-warning)", over: "var(--status-critical)" };

// Celda: plana con divisores en escritorio, card en celular.
const cell = "min-w-0 p-5 lg:px-7 lg:py-6 max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)]";

function Label({ children, action }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2 h-5">
      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
        {children}
      </p>
      {action}
    </div>
  );
}

function Spent({ expenses, bm }) {
  const total = monthlyTotal(expenses, bm);
  const byMethod = monthlyTotalByPaymentMethod(expenses, bm);
  return (
    <div className={`${cell} sm:col-span-2 lg:col-span-1 lg:border-r`}>
      <Label>Gastado en el período</Label>
      {/* El tamaño acompaña el ancho de la ventana para que montos largos ($ 1.234.567) no se salgan. */}
      <p className="font-mono text-4xl lg:text-[clamp(1.875rem,2.7vw,2.75rem)] font-semibold tabular-nums whitespace-nowrap leading-none tracking-tight">{money(total)}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-3" style={{ color: "var(--text-muted)" }}>
        <span className="whitespace-nowrap">
          Crédito <b className="font-mono font-semibold" style={{ color: "var(--text)" }}>{money(byMethod.credito)}</b>
        </span>
        <span className="whitespace-nowrap">
          Débito <b className="font-mono font-semibold" style={{ color: "var(--text)" }}>{money(byMethod.debito)}</b>
        </span>
        {byMethod.sin > 0 && (
          <span className="whitespace-nowrap">
            Sin indicar <b className="font-mono font-semibold" style={{ color: "var(--text)" }}>{money(byMethod.sin)}</b>
          </span>
        )}
      </div>
      <p className="text-[11px] mt-1.5" style={{ color: "var(--text-faint)" }}>
        Incluye cuotas en curso
      </p>
    </div>
  );
}

/** Meta de gasto: cuánto queda contra el tope, con la marca de dónde "deberías" estar hoy. */
function SpendingGoal({ expenses, bm, current, today, settings, onSettingChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const spent = monthlyTotal(expenses, bm);
  const limit = spendingLimitFromSettings(settings);
  const isCurrent = billingMonthDiff(current, bm) === 0;
  // En períodos cerrados el "ritmo" ya no aplica: se toma el período completo.
  const progress = isCurrent ? billingPeriodProgress(bm, today) : { ratio: 1, daysLeft: 0, dayNumber: 1, totalDays: 1 };
  const { ratio, remaining, perDay, status } = spendingLimitStatus(spent, limit, progress);
  const color = STATUS_COLOR[status];

  async function save(e) {
    e.preventDefault();
    const value = parseFloat(draft.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    await api.setSetting(SPENDING_LIMIT_SETTING_KEY, value);
    onSettingChange(SPENDING_LIMIT_SETTING_KEY, String(value));
    setEditing(false);
  }

  return (
    <div className={`${cell} xl:border-r`}>
      <Label
        action={
          !editing && (
            <button
              onClick={() => {
                setDraft(String(limit));
                setEditing(true);
              }}
              className="rounded-md p-1 sidebar-link"
              style={{ color: "var(--text-faint)" }}
              aria-label="Editar tope de gasto"
              title="Editar tope de gasto"
            >
              <Pencil size={13} />
            </button>
          )
        }
      >
        Meta de gasto
      </Label>
      {editing ? (
        <form onSubmit={save} className="flex items-center gap-1.5 mb-3">
          <span className="font-mono" style={{ color: "var(--text-muted)" }}>
            $
          </span>
          <input autoFocus inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1 min-w-0 h-9 rounded-lg px-2 text-sm font-mono" aria-label="Tope de gasto del período" />
          <button type="submit" className="rounded-md p-1.5" style={{ color: "var(--accent-strong)" }} aria-label="Guardar">
            <Check size={15} />
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-md p-1.5" style={{ color: "var(--text-faint)" }} aria-label="Cancelar">
            <X size={15} />
          </button>
        </form>
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-2 mb-3 min-w-0">
          <span className="font-mono text-2xl font-semibold tabular-nums whitespace-nowrap" style={{ color: status === "over" ? "var(--status-critical)" : undefined }}>
            {money(Math.abs(remaining))}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {status === "over" ? "por encima del tope" : "disponibles"}
          </span>
        </p>
      )}
      <div
        className="relative rounded-full"
        style={{ height: 8, background: "var(--surface-alt)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.round(limit)}
        aria-valuenow={Math.round(spent)}
        aria-label="Gasto del período contra la meta"
      >
        <div className="h-full rounded-full" style={{ width: `${Math.min(ratio, 1) * 100}%`, background: color, transition: "width 0.3s" }} />
        {isCurrent && progress.daysLeft > 0 && (
          <span className="absolute -top-1 -bottom-1 rounded-full" style={{ left: `calc(${progress.ratio * 100}% - 1px)`, width: 2, background: "var(--text-muted)" }} title="Dónde estarías hoy gastando parejo hasta el tope" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
        <span className="truncate">
          <b style={{ color: status === "good" ? "var(--text-muted)" : color }}>{pct(ratio)} usado</b>
          {isCurrent && remaining > 0 && progress.daysLeft > 0 && ` · ${money(perDay)}/día`}
        </span>
        <span className="font-mono whitespace-nowrap">de {money(limit)}</span>
      </div>
    </div>
  );
}

function Balance({ expenses, incomes, bm }) {
  const spent = monthlyTotal(expenses, bm);
  const income = monthlyIncome(incomes, bm);
  const saved = income - spent;
  const rate = income > 0 ? saved / income : null;
  const color = rate == null ? "var(--text-faint)" : rate < 0 ? "var(--status-critical)" : rate >= 0.2 ? "var(--status-good)" : "var(--status-warning)";
  return (
    <div className={`${cell} lg:col-span-2 xl:col-span-1 lg:border-t xl:border-t-0`}>
      <Label>Balance del período</Label>
      {income > 0 ? (
        <>
          <p className="flex items-baseline gap-2 mb-3">
            <span className="font-mono text-2xl font-semibold tabular-nums whitespace-nowrap" style={{ color }}>
              {money(Math.abs(saved))}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {saved >= 0 ? `ahorro · ${pct(rate)}` : "de déficit"}
            </span>
          </p>
          <div className="relative rounded-full overflow-hidden" style={{ height: 8, background: "var(--surface-alt)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(1, spent / income) * 100}%`, background: "var(--chart-cat-2)" }} />
            <span className="absolute top-0 bottom-0" style={{ left: "80%", width: 2, background: "var(--text-faint)" }} title="80%: deja 20% de ahorro" />
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
            <span className="truncate">Ingresos {money(income)}</span>
            <span className="whitespace-nowrap">gastaste el {pct(spent / income)}</span>
          </div>
        </>
      ) : (
        <>
          <p className="font-mono text-2xl font-semibold mb-2" style={{ color: "var(--text-faint)" }}>
            —
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Cargá tus ingresos para ver cuánto ahorrás.
          </p>
          <Link to="/gastos/ingresos" className="ghost-action inline-flex items-center gap-0.5 text-xs font-semibold mt-1 px-2 py-1 -mx-2" style={{ color: "var(--accent-strong)" }}>
            Cargar ingresos
            <ChevronRight size={13} />
          </Link>
        </>
      )}
    </div>
  );
}

/** Gastado, meta de gasto y balance del período elegido. */
export function KpiStrip({ expenses, incomes, settings, bm, current, today, onSettingChange }) {
  return (
    // Celular: gastado arriba y meta + balance en dos columnas. Escritorio: tira plana (el balance baja a su
    // propia fila entre 1024 y 1279px) con 35% / 30% / 35%: gastado y balance iguales, la meta un poco más chica.
    <section aria-label="Números del período" className="grid gap-3 sm:grid-cols-2 lg:gap-0 xl:grid-cols-[minmax(0,35fr)_minmax(0,30fr)_minmax(0,35fr)] lg:border-b">
      <Spent expenses={expenses} bm={bm} />
      <SpendingGoal expenses={expenses} bm={bm} current={current} today={today} settings={settings} onSettingChange={onSettingChange} />
      <Balance expenses={expenses} incomes={incomes} bm={bm} />
    </section>
  );
}
