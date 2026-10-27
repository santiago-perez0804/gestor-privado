import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileDown, TrendingUp, X } from "lucide-react";
import { Modal } from "../../common/Modal.jsx";
import { api } from "../../../lib/api.js";
import { withCustomPeriod, withoutCustomPeriod } from "../../../../../shared/finanzas/period.js";
import {
  billingMonthAdd,
  billingMonthDiff,
  billingMonthKey,
  billingPeriodBounds,
  billingPeriodProgress,
  billingPeriodRange,
  CLOSINGS_SETTING_KEY,
  CUTOFF_DAY,
  CUTOFF_SETTING_KEY,
  isCustomPeriod,
  MONTHS_ES,
  periodCfg,
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

const PERIOD_ERRORS = {
  invalid_dates: "Completá las dos fechas.",
  invalid_length: "Un período tiene que durar entre 20 y 45 días.",
  overlaps_neighbor: "Esas fechas se pisan con el período anterior o el siguiente.",
};

/**
 * Período de la tarjeta: las fechas de este período (los bancos corren el cierre) y el día de cierre
 * habitual para el resto. Al guardar se recarga para recalcular todo.
 */
function PeriodModal({ bm, onClose }) {
  const bounds = billingPeriodBounds(bm);
  const [start, setStart] = useState(bounds.start);
  const [end, setEnd] = useState(bounds.end);
  const [day, setDay] = useState(String(CUTOFF_DAY));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const custom = isCustomPeriod(bm);
  const cfg = periodCfg();

  async function save(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      window.location.reload();
    } catch (err) {
      setError(PERIOD_ERRORS[err.message] ?? `No se pudo guardar (${err.message}).`);
      setBusy(false);
    }
  }
  const saveRange = (e) => {
    e.preventDefault();
    save(() => api.setSetting(CLOSINGS_SETTING_KEY, JSON.stringify(withCustomPeriod(bm, { start, end }, cfg))));
  };
  const resetRange = () => save(() => api.setSetting(CLOSINGS_SETTING_KEY, JSON.stringify(withoutCustomPeriod(bm, cfg))));
  const saveDay = () => {
    const n = parseInt(day, 10);
    if (!(n >= 1 && n <= 28)) return setError("El día de cierre va del 1 al 28.");
    save(() => api.setSetting(CUTOFF_SETTING_KEY, n));
  };
  const days = start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1 : null;

  return (
    <Modal onClose={onClose} labelledBy="period-title" width="28rem">
      <form onSubmit={saveRange}>
        <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 id="period-title" className="text-base font-semibold mr-auto">
            Período de {MONTHS_ES[bm.month]} {bm.year}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Poné las fechas que dice el resumen de la tarjeta. El período anterior termina el día antes y el siguiente arranca el día después del cierre.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                Desde
              </span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full h-10 rounded-lg px-3 text-sm" />
            </label>
            <label className="block">
              <span className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                Hasta (cierre)
              </span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full h-10 rounded-lg px-3 text-sm" />
            </label>
          </div>
          {days > 0 && (
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              {days} días.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {custom && (
              <button type="button" onClick={resetRange} disabled={busy} className="ghost-action text-sm px-2 py-1 mr-auto" style={{ color: "var(--text-muted)" }}>
                Volver al cierre del día {CUTOFF_DAY}
              </button>
            )}
            <button type="submit" disabled={busy} className="ml-auto h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              Guardar fechas
            </button>
          </div>
          <div className="flex items-center gap-2 pt-3 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-muted)" }}>Para los demás meses, cierre el día</span>
            <input type="number" min="1" max="28" value={day} onChange={(e) => setDay(e.target.value)} className="w-14 h-9 rounded-md px-2 text-sm font-mono" aria-label="Día de cierre habitual" />
            {Number(day) !== CUTOFF_DAY && (
              <button type="button" onClick={saveDay} disabled={busy} className="ghost-action font-semibold px-2 py-1" style={{ color: "var(--accent-strong)" }}>
                Guardar
              </button>
            )}
          </div>
          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** Rango del período; al tocarlo se ajustan sus fechas o el día de cierre habitual. */
function RangeAndCutoff({ bm }) {
  const [open, setOpen] = useState(false);
  const custom = isCustomPeriod(bm);
  return (
    <>
      <button onClick={() => setOpen(true)} className="ghost-action text-xs whitespace-nowrap h-9 px-2.5" style={{ color: "var(--text-muted)" }} title={custom ? "Fechas puestas a mano. Tocá para cambiarlas." : `Cierre de la tarjeta: día ${CUTOFF_DAY}. Tocá para ajustar este período.`}>
        {billingPeriodRange(bm)}
        {custom && " ✎"}
      </button>
      {open && <PeriodModal bm={bm} onClose={() => setOpen(false)} />}
    </>
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
