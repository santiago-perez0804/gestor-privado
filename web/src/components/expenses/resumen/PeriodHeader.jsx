import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileDown, TrendingUp } from "lucide-react";
import { api } from "../../../lib/api.js";
import {
  billingMonthAdd,
  billingMonthDiff,
  billingMonthKey,
  billingPeriodProgress,
  billingPeriodRange,
  CUTOFF_DAY,
  CUTOFF_SETTING_KEY,
  MONTHS_ES,
} from "../../../lib/billing.js";

const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** ‹ Octubre 2026 › — `oldest`/`newest` limitan hasta dónde se puede ir. */
function PeriodNavigator({ bm, oldest, newest, onChange }) {
  const canPrev = billingMonthDiff(bm, oldest) > 0;
  const canNext = billingMonthDiff(newest, bm) > 0;
  const arrow = "flex items-center justify-center w-9 h-9 rounded-lg disabled:opacity-30 sidebar-link";
  return (
    <div className="flex items-center rounded-xl p-0.5" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <button className={arrow} onClick={() => onChange(billingMonthAdd(bm, -1))} disabled={!canPrev} aria-label="Período anterior" style={{ color: "var(--text-muted)" }}>
        <ChevronLeft size={16} />
      </button>
      <span className="px-2 text-sm font-semibold text-center whitespace-nowrap min-w-[8.5rem]" aria-live="polite">
        {cap(MONTHS_ES[bm.month])} {bm.year}
      </span>
      <button className={arrow} onClick={() => onChange(billingMonthAdd(bm, 1))} disabled={!canNext} aria-label="Período siguiente" style={{ color: "var(--text-muted)" }}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/** Rango del período; al tocarlo se edita el día de cierre de la tarjeta (recarga para recalcular todo). */
function RangeAndCutoff({ bm }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(CUTOFF_DAY));
  if (!editing)
    return (
      <button onClick={() => setEditing(true)} className="ghost-action text-xs whitespace-nowrap h-9 px-2.5" style={{ color: "var(--text-muted)" }} title={`Cierre de la tarjeta: día ${CUTOFF_DAY}. Tocá para cambiarlo.`}>
        {billingPeriodRange(bm)}
      </button>
    );
  return (
    <form
      className="flex items-center gap-1 text-xs"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = parseInt(draft, 10);
        if (n >= 1 && n <= 28 && n !== CUTOFF_DAY) {
          await api.setSetting(CUTOFF_SETTING_KEY, n);
          window.location.reload();
        }
        setEditing(false);
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>Cierre día</span>
      <input autoFocus type="number" min="1" max="28" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setEditing(false)} className="w-12 rounded-md px-1.5 py-1 text-xs font-mono" aria-label="Día de cierre de la tarjeta" />
      <button type="submit" onMouseDown={(e) => e.preventDefault()} className="ghost-action font-semibold h-8 px-2" style={{ color: "var(--accent-strong)" }}>
        OK
      </button>
    </form>
  );
}

function StatusBadge({ bm, current, today }) {
  const diff = billingMonthDiff(current, bm);
  if (diff > 0)
    return (
      <span className="text-[11px] font-semibold rounded-md px-2 py-1 whitespace-nowrap" style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}>
        Cerrado
      </span>
    );
  const { daysLeft, dayNumber, totalDays } = billingPeriodProgress(bm, today);
  const when = daysLeft === 0 ? "Cierra hoy" : daysLeft === 1 ? "Cierra mañana" : `Faltan ${daysLeft} días`;
  return (
    <span className="text-[11px] font-semibold rounded-md px-2 py-1 whitespace-nowrap" style={{ background: "color-mix(in srgb, var(--status-good) 14%, transparent)", color: "var(--status-good)" }}>
      {when} · día {dayNumber}/{totalDays}
    </span>
  );
}

const ghostButton = "flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-semibold whitespace-nowrap sidebar-link";

/** Encabezado del Resumen: título, navegador de período, estado del cierre y accesos. */
export function PeriodHeader({ bm, current, oldest, today, onChange }) {
  const isCurrent = billingMonthDiff(current, bm) === 0;
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-3 lg:px-7 lg:py-4 lg:border-b">
      <div className="min-w-0 mr-auto">
        <p className="text-[11px] hidden lg:block" style={{ color: "var(--text-faint)" }}>
          Finanzas
        </p>
        <h1 className="text-lg lg:text-xl font-semibold leading-tight">Resumen</h1>
      </div>
      <div className="order-last w-full flex flex-wrap items-center gap-x-3 gap-y-2 sm:order-none sm:w-auto">
        <PeriodNavigator bm={bm} oldest={oldest} newest={current} onChange={onChange} />
        {/* Entre 1024 y 1279px no entra en el encabezado: se oculta solo ahí. */}
        <span className="inline lg:hidden xl:inline">
          <RangeAndCutoff bm={bm} />
        </span>
        <StatusBadge bm={bm} current={current} today={today} />
        {!isCurrent && (
          <button onClick={() => onChange(current)} className="ghost-action text-xs font-semibold h-9 px-2.5" style={{ color: "var(--accent-strong)" }}>
            Ir al actual
          </button>
        )}
      </div>
      <Link to="/gastos/proyeccion" className={`${ghostButton} px-2.5 xl:px-3.5`} style={{ border: "1px solid var(--border)" }} title="Proyección de los próximos meses">
        <TrendingUp size={16} style={{ color: "var(--accent)" }} />
        <span className="hidden xl:inline">Proyección</span>
      </Link>
      <Link to={`/gastos/informe?periodo=${billingMonthKey(bm)}`} className={`${ghostButton} w-10`} style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }} title="Informe del período (PDF)" aria-label="Informe del período en PDF">
        <FileDown size={16} />
      </Link>
    </header>
  );
}
