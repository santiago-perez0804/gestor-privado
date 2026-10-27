import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Pencil, Trash2, X } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { Panel } from "../../components/common/Section.jsx";
import { StatCell } from "../../components/fisico/bits.jsx";
import { LineChart } from "../../components/fisico/charts.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { addDays, localDateTime, num, parseNum, signed, typoCheck } from "../../lib/fisico/index.js";
import { useFisico } from "./FisicoContext.jsx";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const short = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}`;
const long = (d) => `${Number(d.slice(8, 10))} de ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const range = (a, b) => (a.slice(5, 7) === b.slice(5, 7) ? `${Number(a.slice(8, 10))}–${short(b)}` : `${short(a)} – ${short(b)}`);
const STATUS = { slow: "var(--text-muted)", healthy: "var(--accent-strong)", fast: "var(--status-warning)", unknown: "var(--text-faint)" };

/** Alta rápida: peso y fecha/hora (por defecto ahora). Avisa sin bloquear si parece un error de tipeo. */
function WeighInForm({ trend, jump, onSaved }) {
  const [kg, setKg] = useState("");
  const [at, setAt] = useState(() => localDateTime(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const value = parseNum(kg);
  const typo = typoCheck(value, trend, jump);
  async function save(e) {
    e.preventDefault();
    if (!(value > 20 && value < 400)) return setError("Poné un peso válido.");
    setBusy(true);
    setError(null);
    try {
      await api.addWeight({ weight: value, recordedAt: at });
      setKg("");
      setAt(localDateTime(new Date()));
      onSaved();
    } catch (err) {
      setError(`No se pudo guardar (${err.message}).`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      <input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" placeholder="Peso (kg)" aria-label="Peso en kilos" className="h-10 w-28 rounded-lg px-3 text-sm font-mono" />
      <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Fecha y hora" className="h-10 rounded-lg px-3 text-sm" />
      <button disabled={busy} className="h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        Registrar
      </button>
      {typo.suspicious && (
        <p role="status" className="basis-full flex items-center gap-1.5 text-xs" style={{ color: "var(--status-warning)" }}>
          <AlertTriangle size={13} /> Son {num(Math.abs(typo.diff), { max: 1 })} kg {typo.diff > 0 ? "más" : "menos"} que tu tendencia: ¿está bien escrito? (se guarda igual)
        </p>
      )}
      {error && (
        <p className="basis-full text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

/** La meta: kilos y fecha (opcional). */
function GoalEditor({ goal, onSaved }) {
  const [target, setTarget] = useState(goal?.target ?? "");
  const [date, setDate] = useState(goal?.targetDate ?? "");
  const [editing, setEditing] = useState(false);
  const save = async () => {
    const t = parseNum(target);
    if (!(t > 20)) return;
    await api.setWeightGoal({ target: t, targetDate: date || null });
    setEditing(false);
    onSaved();
  };
  if (!editing && goal)
    return (
      <button onClick={() => setEditing(true)} className="hover-surface flex items-center gap-2 h-9 px-3 mt-1.5 text-sm font-semibold" style={{ border: "1px solid var(--border)" }}>
        {goal.targetDate ? long(goal.targetDate) : "Sin fecha"} <Pencil size={13} style={{ color: "var(--text-faint)" }} />
      </button>
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="kg" aria-label="Meta en kilos" className="h-9 w-16 rounded-lg px-2 text-sm font-mono" />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha de la meta" className="h-9 rounded-lg px-2 text-sm" />
      <button onClick={save} aria-label="Guardar meta" className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        <Check size={15} />
      </button>
    </div>
  );
}

/** El semáforo: % del peso por semana, con la banda saludable. */
function RateGauge({ you, goal, healthy }) {
  const max = 1;
  const pos = (v) => `${Math.min(100, (Math.abs(v) / max) * 100)}%`;
  return (
    <div>
      <div className="relative h-14">
        <div className="absolute inset-x-0 top-7 h-2 rounded-full" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }} />
        <div className="absolute top-7 h-2" style={{ left: pos(healthy.min), width: `${((healthy.max - healthy.min) / max) * 100}%`, background: "color-mix(in srgb, var(--accent) 40%, transparent)" }} />
        <div className="absolute top-7 h-2 rounded-r-full" style={{ left: pos(healthy.max), right: 0, background: "color-mix(in srgb, var(--status-warning) 35%, transparent)" }} />
        {you != null && (
          <div className="absolute top-0 flex flex-col items-center -translate-x-1/2" style={{ left: pos(you) }}>
            <span className="font-mono text-[11px] whitespace-nowrap">vos {num(Math.abs(you), { max: 2 })}%</span>
            <span className="w-0.5 h-5 mt-0.5" style={{ background: "var(--text)" }} />
          </div>
        )}
        {goal != null && (
          <div className="absolute top-6 flex flex-col items-center -translate-x-1/2" style={{ left: pos(goal) }}>
            <span className="w-0.5 h-4" style={{ background: "var(--accent)" }} />
            <span className="font-mono text-[11px] whitespace-nowrap" style={{ color: "var(--accent-strong)" }}>
              meta {num(goal, { max: 2 })}%
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-between font-mono text-[10px] mt-3" style={{ color: "var(--text-faint)" }}>
        <span>0%</span>
        <span>0,5%</span>
        <span>1%</span>
      </div>
    </div>
  );
}

function WeighInRow({ w, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [kg, setKg] = useState(String(w.kg).replace(".", ","));
  const [at, setAt] = useState(w.recordedAt.slice(0, 16));
  const save = async () => {
    await api.updateWeight(w.id, { weight: parseNum(kg), recordedAt: at });
    setEditing(false);
    onChanged();
  };
  return (
    <li className="flex items-center gap-2 py-2 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
      {editing ? (
        <>
          <input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" aria-label="Peso" className="h-9 w-20 rounded-lg px-2 font-mono" />
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Fecha y hora" className="h-9 rounded-lg px-2" />
          <button onClick={save} aria-label="Guardar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--accent-strong)" }}>
            <Check size={15} />
          </button>
          <button onClick={() => setEditing(false)} aria-label="Cancelar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <X size={15} />
          </button>
        </>
      ) : (
        <>
          <span className="font-mono w-16">{num(w.kg, { decimals: 1 })}</span>
          <span className="flex-1" style={{ color: "var(--text-muted)" }}>
            {short(w.day)} · {w.recordedAt.slice(11, 16) || "—"}
          </span>
          <button onClick={() => setEditing(true)} aria-label="Editar pesada" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
            <Pencil size={14} />
          </button>
          <button onClick={async () => (await api.deleteWeight(w.id), onChanged())} aria-label="Borrar pesada" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
            <Trash2 size={14} />
          </button>
        </>
      )}
    </li>
  );
}

export function Peso() {
  const { version, bump } = useFisico();
  const sumApi = useApi(() => api.getWeightSummary(), [version]);
  const [showAll, setShowAll] = useState(false);
  const s = sumApi.data;
  if (!s) return null;
  const p = s.projection;
  const g = s.goal;
  const rate = s.rate;
  const chart = s.chart;
  const healthy = s.healthyRatePct;

  // Frase debajo del gráfico.
  let sentence = null;
  if (g && p?.reached) sentence = `Llegaste a la meta de ${num(g.target)} kg. Para mantenerla, apuntá a un ritmo cerca de 0.`;
  else if (g && g.targetDate && p?.neededKgPerWeek != null) {
    const at = p.atTargetDate != null ? `Al ritmo actual el ${long(g.targetDate)} estarías en ${num(p.atTargetDate, { max: 1 })} kg. ` : "";
    const need = `Para llegar a ${num(g.target)} necesitás ${num(Math.abs(p.neededKgPerWeek), { max: 2 })} kg por semana`;
    sentence =
      s.neededStatus === "fast"
        ? `${at}${need} (${num(p.neededPct, { max: 2 })}% de tu peso): más rápido de lo saludable. A ${num(healthy.max)}% por semana llegarías el ${long(s.healthyDate)}.`
        : s.neededStatus === "healthy"
          ? `${at}${need}: es exigente pero saludable.`
          : `${at}${need}: tranqui, es un ritmo suave.`;
  } else if (g && p?.etaDate) sentence = `A este ritmo llegás a ${num(g.target)} kg el ${long(p.etaDate)}. Poné una fecha para saber qué ritmo necesitás.`;
  else if (g && rate) sentence = `Con el ritmo de las últimas semanas no te acercás a ${num(g.target)} kg.`;

  const lineColor = { current: "color-mix(in srgb, var(--text) 55%, transparent)", goal: "var(--accent)" };
  const xLabel = (x) => short(addDays(chart.firstDay, x));

  return (
    <PageTransition>
      <PageBar crumb="Físico · Cuerpo" title="Peso">
        <WeighInForm trend={s.current} jump={s.typoJumpKg} onSaved={bump} />
      </PageBar>
      <section className="grid gap-3 grid-cols-1 sm:grid-cols-3 lg:gap-0 lg:border-b lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0">
        <StatCell label="Tendencia hoy" value={s.current != null ? <span className="font-mono text-3xl">{num(s.current, { decimals: 1 })} <span className="text-sm">kg</span></span> : "Sin pesadas"} sub={s.last ? `Última pesada ${num(s.last.kg, { decimals: 1 })} · ${short(s.last.day)}` : "Registrá la primera arriba"} />
        <StatCell
          label={rate?.partial ? `Últimos ${rate.days} días` : "Últimas 4 semanas"}
          value={rate ? <span className="font-mono text-3xl" style={{ color: STATUS[s.rateStatus] }}>{signed(rate.change, { max: 1 })} <span className="text-sm">kg</span></span> : "—"}
          sub={rate ? `${signed(rate.kgPerWeek, { max: 2 })} kg por semana · ${num(Math.abs(rate.pctPerWeek), { max: 2 })}% de tu peso` : "Con dos pesadas aparece el ritmo"}
        />
        <div className="min-w-0 p-4 lg:px-7 lg:py-5 max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)]">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {g ? `Meta: ${num(g.target)} kg para el` : "Meta de peso"}
          </p>
          <GoalEditor key={g?.id ?? "none"} goal={g} onSaved={bump} />
          {p?.neededKgPerWeek != null && !p.reached && (
            <p className="text-xs mt-1.5" style={{ color: s.neededStatus === "fast" ? "var(--status-warning)" : "var(--text-faint)" }}>
              Necesitás {num(Math.abs(p.neededKgPerWeek), { max: 2 })} kg/sem · {num(p.neededPct, { max: 2 })}% de tu peso
            </p>
          )}
          {p?.reached && (
            <p className="text-xs mt-1.5" style={{ color: "var(--accent-strong)" }}>
              ¡Meta alcanzada!
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] mt-4 lg:mt-0">
        <Panel className="lg:border-r lg:border-b">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-[15px] font-semibold">Tendencia y proyección</h2>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span>● Pesadas</span>
              <span style={{ color: "var(--accent-strong)" }}>— Tendencia</span>
              {chart.lines.some((l) => l.id === "current") && <span>- - Ritmo actual</span>}
              {chart.lines.some((l) => l.id === "goal") && <span style={{ color: "var(--accent-strong)" }}>- - Ritmo para tu meta</span>}
            </div>
          </div>
          {chart.weighIns.length ? (
            <LineChart
              ariaLabel="Pesadas, tendencia y proyección"
              series={[
                { points: chart.weighIns, color: "var(--text-faint)", line: false, dots: true, dotSize: 2.5 },
                { points: chart.trend, color: "var(--accent)", width: 2.5 },
                ...chart.lines.map((l) => ({ points: l.points, color: lineColor[l.id], dashed: true, endLabel: l.id === "current" ? `${num(l.points.at(-1).y, { max: 1 })} kg` : null })),
              ]}
              refLines={[...(g ? [{ y: g.target, label: `Meta ${num(g.target)} kg` }] : []), { x: chart.todayX, label: "hoy" }]}
              xLabels={[
                { x: 0, label: xLabel(0) },
                { x: chart.todayX, label: "" },
                { x: Math.max(chart.todayX, ...chart.lines.flatMap((l) => l.points.map((pt) => pt.x))), label: short(chart.endDay) },
              ]}
              yFormat={(y) => num(y, { max: 0 })}
            />
          ) : (
            <p className="text-sm py-10 text-center" style={{ color: "var(--text-muted)" }}>
              Registrá tu peso arriba para ver la tendencia.
            </p>
          )}
          {sentence && <p className="text-sm mt-3">{sentence}</p>}
        </Panel>
        <Panel className="lg:border-b">
          <h2 className="text-[15px] font-semibold">¿Es un buen ritmo?</h2>
          <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>
            % de tu peso que bajás por semana
          </p>
          <RateGauge you={rate?.pctPerWeek ?? null} goal={p?.neededPct ?? null} healthy={healthy} />
          <ul className="space-y-2 mt-4 text-sm">
            <li className="flex gap-2">
              <span className="w-3 h-3 rounded-sm mt-1 shrink-0" style={{ background: "color-mix(in srgb, var(--accent) 40%, transparent)" }} />
              <span>
                <b>
                  {num(healthy.min)}–{num(healthy.max)}% por semana
                </b>{" "}
                baja grasa cuidando el músculo si entrenás pesado.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-3 h-3 rounded-sm mt-1 shrink-0" style={{ background: "color-mix(in srgb, var(--status-warning) 35%, transparent)" }} />
              <span>
                <b>Más de {num(healthy.max)}%</b> llega antes, pero en atletas se perdió la ganancia de masa magra.
              </span>
            </li>
          </ul>
          <p className="text-[11px] mt-3" style={{ color: "var(--text-faint)" }}>
            Basado en Garthe et al. (2011): 0,7% semanal vs 1,4% en atletas que entrenaban fuerza.
          </p>
        </Panel>
        <Panel className="lg:border-r">
          <h2 className="text-[15px] font-semibold">Promedio por semana</h2>
          <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>
            El número que vale comparar. El del día sube y baja con agua, sal y carbohidratos.
          </p>
          {s.weeks.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  <th className="text-left font-normal pb-1.5">Semana</th>
                  <th className="text-right font-normal pb-1.5">Promedio</th>
                  <th className="text-right font-normal pb-1.5">vs semana anterior</th>
                  <th className="text-right font-normal pb-1.5">Pesadas</th>
                </tr>
              </thead>
              <tbody>
                {s.weeks.map((w) => (
                  <tr key={w.weekStart} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="py-2">{range(w.weekStart, w.weekEnd)}</td>
                    <td className="py-2 text-right font-mono">{num(w.avg, { decimals: 2 })}</td>
                    <td className="py-2 text-right font-mono" style={{ color: w.diff == null ? "var(--text-faint)" : w.diff < 0 ? "var(--accent-strong)" : w.diff > 0 ? "var(--status-warning)" : undefined }}>
                      {w.diff == null ? "—" : signed(w.diff, { decimals: 2 })}
                    </td>
                    <td className="py-2 text-right" style={{ color: "var(--text-muted)" }}>
                      {w.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Todavía no hay pesadas.
            </p>
          )}
          {s.weighIns.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-1">Pesadas</h3>
              <ul>
                {(showAll ? s.weighIns : s.weighIns.slice(0, 8)).map((w) => (
                  <WeighInRow key={w.id} w={w} onChanged={bump} />
                ))}
              </ul>
              {s.weighIns.length > 8 && (
                <button onClick={() => setShowAll((v) => !v)} className="ghost-action text-xs font-semibold mt-2 px-1" style={{ color: "var(--accent-strong)" }}>
                  {showAll ? "Ver menos" : `Ver las ${s.weighIns.length}`}
                </button>
              )}
            </div>
          )}
        </Panel>
        <Panel>
          <h2 className="text-[15px] font-semibold mb-3">Para que el número sirva</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>En ayunas, después del baño, misma balanza.</li>
            <li>2 o 3 veces por semana alcanza. Más pesadas suavizan mejor la tendencia, no la cambian.</li>
            <li>Si un día salta 1 kg, no es grasa: mirá la línea verde.</li>
            <li>
              En recomposición, cruzalo con{" "}
              <Link to="/fisico/medidas" className="font-semibold" style={{ color: "var(--accent-strong)" }}>
                cintura
              </Link>{" "}
              y{" "}
              <Link to="/fisico/fotos" className="font-semibold" style={{ color: "var(--accent-strong)" }}>
                fotos
              </Link>
              .
            </li>
          </ol>
        </Panel>
      </div>
    </PageTransition>
  );
}
