import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { currency, formatShortDate } from "../../../lib/format.js";
import { getBillingMonth, billingMonthDiff, MONTHS_ES_ABBR } from "../../../lib/billing.js";
import { installmentPlans, releasesByMonth } from "../../../lib/installments.js";
import { normalizeTitle } from "../../../lib/merchants.js";

const MOBILE_ROWS = 4;

/** "Buenos Días ×5, Comida, Pan integral" */
function groupTitles(expenses) {
  const groups = new Map();
  for (const e of expenses) {
    const key = normalizeTitle(e.title);
    const g = groups.get(key) || { title: e.title, n: 0 };
    g.n += 1;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => (g.n > 1 ? `${g.title} ×${g.n}` : g.title)).join(", ");
}

/**
 * Cuánto falta pagar en cuotas y qué se libera en los próximos meses:
 * las compras que están por pagar su última cuota y, después, los montos que quedan libres por mes.
 */
export function InstallmentsPanel({ expenses, today }) {
  const { active, totalRemaining, timeline } = useMemo(() => {
    const current = getBillingMonth(today);
    const active = installmentPlans(expenses, today).filter((p) => !p.done);
    const lastOnes = active
      .filter((p) => p.next && p.paid === p.n - 1)
      .map((p) => {
        const bm = getBillingMonth(p.next.date);
        return { key: `last-${p.expense.id}`, bm, date: p.next.date, kind: "last", title: `Última cuota de ${p.expense.title}`, sub: `${p.n}/${p.n} · vence el ${formatShortDate(p.next.date)}`, amount: p.installment };
      });
    const releases = releasesByMonth(expenses, current, 6).map((r) => ({
      key: `rel-${r.billingMonth.year}-${r.billingMonth.month}`,
      bm: r.billingMonth,
      kind: "release",
      title: "Se liberan por mes",
      sub: groupTitles(r.expenses),
      amount: r.amount,
    }));
    // Por mes; dentro del mes, primero las últimas cuotas (por fecha) y después lo que se libera.
    const timeline = [...lastOnes, ...releases]
      .sort((a, b) => billingMonthDiff(a.bm, b.bm) || (a.kind === b.kind ? (a.date || "").localeCompare(b.date || "") : a.kind === "last" ? -1 : 1));
    return { active, totalRemaining: active.reduce((s, p) => s + p.remainingAmount, 0), timeline };
  }, [expenses, today]);

  return (
    // Escritorio: ocupa el alto que deja el formulario; el encabezado queda fijo y el resto scrollea.
    <section className="p-5 lg:px-6 lg:pt-5 lg:pb-0 lg:border-t lg:flex-1 lg:min-h-0 lg:flex lg:flex-col max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)]" aria-labelledby="installments-title">
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <h2 id="installments-title" className="text-base font-semibold">
          Cuotas en curso
        </h2>
        {active.length > 0 && (
          <Link to="/gastos/proyeccion" className="ghost-action text-xs font-semibold whitespace-nowrap px-2 py-1 -mr-2" style={{ color: "var(--accent-strong)" }}>
            Ver las {active.length}
          </Link>
        )}
      </div>

      {active.length === 0 ? (
        <p className="flex items-center gap-2 text-sm lg:pb-5" style={{ color: "var(--text-muted)" }}>
          <CalendarClock size={15} style={{ color: "var(--text-faint)" }} />
          No tenés compras en cuotas pendientes.
        </p>
      ) : (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2 mb-3 shrink-0">
            <span className="font-mono text-3xl font-semibold tabular-nums whitespace-nowrap">{currency.format(Math.round(totalRemaining))}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              por pagar en {active.length} {active.length === 1 ? "compra" : "compras"}
            </span>
          </p>

          <div className="thin-scroll lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:-mx-6 lg:px-6 lg:pb-5">
            {timeline.length > 0 && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider mt-1 mb-1" style={{ color: "var(--text-faint)" }}>
                  Lo que se libera
                </p>
                <ol>
                  {timeline.map((row, i) => (
                    // En celular se ven las primeras 4; en escritorio todas (hay scroll).
                    <li key={row.key} className={`${i >= MOBILE_ROWS ? "hidden lg:grid" : "grid"} grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-x-3 py-2.5`} style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="font-mono text-[11px] font-semibold uppercase pt-0.5" style={{ color: "var(--text-faint)" }}>
                        {MONTHS_ES_ABBR[row.bm.month]}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{row.title}</p>
                        <p className="text-[11px] leading-snug mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }} title={row.sub}>
                          {row.sub}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums whitespace-nowrap pt-0.5" style={{ color: row.kind === "release" ? "var(--status-good)" : undefined }}>
                        {row.kind === "release" ? "+ " : ""}
                        {currency.format(Math.round(row.amount))}
                      </span>
                    </li>
                  ))}
                </ol>
                {timeline.some((r) => r.kind === "release") && (
                  <Link to="/gastos/metas" className="ghost-action flex items-center justify-between gap-2 px-3 py-2 -mx-3 mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
                    <span>Mandá lo que se libera a una meta de ahorro.</span>
                    <span className="font-semibold whitespace-nowrap" style={{ color: "var(--accent-strong)" }}>
                      Crear meta
                    </span>
                  </Link>
                )}
              </>
            )}

            {/* Escritorio: el detalle de cada compra en cuotas (en celular está en la página Cuotas). */}
            <div className="hidden lg:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider mt-4 mb-1" style={{ color: "var(--text-faint)" }}>
                Compras en cuotas
              </p>
              <ul>
                {active.map((p) => (
                  <li key={p.expense.id} className="py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium truncate">{p.expense.title}</p>
                      <span className="font-mono text-sm font-semibold tabular-nums whitespace-nowrap">{currency.format(Math.round(p.installment))}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
                      <span className="truncate">
                        {p.paid}/{p.n} {p.paid === 1 ? "paga" : "pagas"}
                        {p.next ? ` · próxima ${formatShortDate(p.next.date)}` : " · sin cuotas por pagar"}
                      </span>
                      <span className="font-mono whitespace-nowrap">faltan {currency.format(Math.round(p.remainingAmount))}</span>
                    </div>
                    <div className="flex gap-[2px] mt-1.5" role="img" aria-label={`${p.paid} de ${p.n} cuotas pagas`}>
                      {Array.from({ length: p.n }, (_, i) => (
                        <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i < p.paid ? "var(--accent)" : "var(--surface-alt)" }} />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
