import { useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "../../lib/api.js";
import { EXTRA_ACTIVITIES } from "../../lib/fisico/index.js";
import { WEEKDAY_LABELS } from "../../lib/fisico/labels.js";

const EXTRA_COLOR = { calistenia: "#9b87f5", bici: "#e8705f", caminata: "#5fc4b5", correr: "#e39b5f", natación: "#6ea8fe", fútbol: "#7fc97f", movilidad: "#d4a23c" };
export const extraColor = (x) => EXTRA_COLOR[x] ?? "var(--text-faint)";
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** La semana tipo: un select por día (rutina o descanso) y las actividades sin rutina de ese día. */
export function WeekScheduleEditor({ plan, onChanged }) {
  const [days, setDays] = useState(plan.schedule);
  const [adding, setAdding] = useState(null); // weekday donde se está agregando una actividad
  const [error, setError] = useState(null);

  async function save(next) {
    setDays(next);
    setError(null);
    try {
      setDays(await api.setPlanSchedule(plan.id, next));
      onChanged?.();
    } catch (err) {
      setError(`No se pudo guardar la agenda (${err.message}).`);
      setDays(plan.schedule);
    }
  }
  const update = (weekday, patch) => save(days.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  return (
    <div>
      <div className="no-scrollbar grid grid-flow-col auto-cols-[minmax(9.5rem,1fr)] lg:grid-flow-row lg:grid-cols-7 gap-2 overflow-x-auto max-lg:-mx-4 max-lg:px-4 pb-1">
        {days.map((d) => (
          <div key={d.weekday} className="rounded-xl p-2.5 flex flex-col gap-2 min-h-[6.5rem]" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              {WEEKDAY_LABELS[d.weekday]}
            </span>
            <select value={d.routineId ?? ""} onChange={(e) => update(d.weekday, { routineId: e.target.value ? Number(e.target.value) : null })} aria-label={`Rutina del ${WEEKDAY_LABELS[d.weekday].toLowerCase()}`} className="h-9 rounded-lg px-2 text-sm w-full" style={d.routineId ? { borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))" } : undefined}>
              <option value="">Descanso</option>
              {plan.routines.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1">
              {d.extras.map((x) => (
                <button key={x} onClick={() => update(d.weekday, { extras: d.extras.filter((y) => y !== x) })} className="group inline-flex items-center gap-1 h-6 pl-1.5 pr-1 rounded-full text-[11px]" style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }} title={`Quitar ${x}`}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: extraColor(x) }} />
                  {cap(x)}
                  <X size={10} className="opacity-50 group-hover:opacity-100" />
                </button>
              ))}
              {adding === d.weekday ? (
                <select autoFocus onBlur={() => setAdding(null)} onChange={(e) => (e.target.value && update(d.weekday, { extras: [...d.extras, e.target.value] }), setAdding(null))} className="h-6 rounded-md px-1 text-[11px]" aria-label="Agregar actividad" defaultValue="">
                  <option value="">Actividad…</option>
                  {EXTRA_ACTIVITIES.filter((x) => !d.extras.includes(x)).map((x) => (
                    <option key={x} value={x}>
                      {cap(x)}
                    </option>
                  ))}
                </select>
              ) : (
                <button onClick={() => setAdding(d.weekday)} aria-label="Agregar actividad" className="hover-surface w-6 h-6 flex items-center justify-center rounded-full" style={{ color: "var(--text-faint)" }}>
                  <Plus size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs mt-2.5" style={{ color: "var(--text-faint)" }}>
        {plan.dailyExtras.length ? `${plan.dailyExtras.map(cap).join(" y ")} todos los días. ` : ""}Si faltás un día, la rutina no se pierde: pasa al siguiente día libre de la semana.
      </p>
      {error && (
        <p className="text-sm mt-2" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
