import { Link } from "react-router-dom";
import { MONTHS_ES_ABBR } from "../../lib/billing.js";
import { TYPE_ORDER, WORK_TYPES } from "../../lib/ocio/types.js";

/** Un bloque por cada cosa terminada, apilados por mes y pintados según el tipo. */
export function MonthlyBlocks({ months, currentMonth }) {
  const max = Math.max(4, ...months.map((m) => m.total));
  const block = Math.max(8, Math.min(18, Math.floor(130 / max)));
  return (
    <div>
      <div className="grid grid-cols-12 gap-1.5 sm:gap-2 items-end" style={{ minHeight: max * (block + 3) + 18 }}>
        {months.map((m) => (
          <div key={m.month} className="flex flex-col items-stretch justify-end h-full">
            {m.total > 0 && (
              <span className="text-[10px] font-mono text-center mb-1" style={{ color: "var(--text-faint)" }}>
                {m.total}
              </span>
            )}
            <div className="flex flex-col-reverse gap-[3px]">
              {TYPE_ORDER.flatMap((t) => m.items.filter((it) => it.type === t)).map((it, i) => (
                <Link
                  key={`${it.entryId}-${i}`}
                  to={`/ocio/obra/${it.entryId}`}
                  title={`${it.title} · ${WORK_TYPES[it.type].label}`}
                  className="block rounded-[4px]"
                  style={{ height: block, background: WORK_TYPES[it.type].color }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-1.5 sm:gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        {MONTHS_ES_ABBR.map((name, i) => (
          <span key={name} className="text-[10px] sm:text-[11px] text-center" style={{ color: i === currentMonth ? "var(--text)" : "var(--text-faint)", fontWeight: i === currentMonth ? 600 : 400 }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
