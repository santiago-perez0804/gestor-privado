import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search, Star } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { Panel } from "../../components/common/Section.jsx";
import { LineChart, Sparkline } from "../../components/fisico/charts.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { kg, num, signed } from "../../lib/fisico/index.js";
import { muscleLabel } from "../../lib/fisico/labels.js";
import { useFisico } from "./FisicoContext.jsx";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dayMonth = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const e1rmText = (v, bw) => (v == null ? "—" : `${bw ? "+" : ""}${num(v, { max: 1 })} kg`);

function RecordDetail({ exerciseId }) {
  const { version } = useFisico();
  const api_ = useApi(() => api.getRecordDetail(exerciseId), [exerciseId, version]);
  const d = api_.data;
  if (!d) return null;
  const bw = d.isBodyweight;
  const points = d.chart.map((p, i) => ({ x: i, y: p.e1rm, mark: p.record })).filter((p) => p.y != null);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="min-w-0 mr-auto">
          {d.primaryMuscle && (
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: d.priority ? "var(--status-warning)" : "var(--accent-strong)" }}>
              {muscleLabel(d.primaryMuscle)} {d.priority && "★"}
            </p>
          )}
          <h2 className="text-2xl font-semibold leading-tight">{d.name}</h2>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            1RM estimado
          </p>
          <p className="font-mono text-3xl font-semibold">{e1rmText(d.bestE1rm?.value, bw)}</p>
        </div>
        {d.bestSet && (
          <div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Mejor serie
            </p>
            <p className="font-mono text-lg font-semibold">
              {bw ? kg(d.bestSet.weightKg, { bodyweight: true }) : num(d.bestSet.weightKg)} × {d.bestSet.reps}{" "}
              <span className="text-xs font-sans font-normal" style={{ color: "var(--text-faint)" }}>
                · {dayMonth(d.bestSet.date)}
              </span>
            </p>
          </div>
        )}
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            En 6 semanas
          </p>
          <p className="font-mono text-lg font-semibold" style={{ color: d.changePct > 0 ? "var(--accent-strong)" : d.changePct < 0 ? "var(--status-warning)" : undefined }}>
            {d.changePct == null ? "—" : `${signed(d.changePct, { max: 1 })}%`}
          </p>
        </div>
      </div>

      {points.length > 1 ? (
        <div>
          <LineChart
            ariaLabel={`Evolución del 1RM estimado de ${d.name}`}
            series={[{ points, color: "var(--accent)", dots: true }]}
            xLabels={[
              { x: 0, label: dayMonth(d.chart[0].date) },
              { x: d.chart.length - 1, label: dayMonth(d.chart.at(-1).date) },
            ]}
            yFormat={(y) => num(y, { max: 0 })}
          />
          <p className="flex items-center gap-1.5 text-xs mt-2" style={{ color: "var(--text-faint)" }}>
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "var(--status-warning)" }} /> Récord nuevo ese día
          </p>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Con dos entrenos de este ejercicio aparece el gráfico.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section>
          <h3 className="text-sm font-semibold mb-2">Récord por repeticiones</h3>
          <div className="flex flex-wrap gap-2">
            {d.byReps.map((r) => (
              <div key={r.reps} className="rounded-xl px-3 py-2 min-w-[4.5rem]" style={{ border: "1px solid var(--border)" }}>
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {r.reps} reps
                </p>
                <p className="font-mono font-semibold">{bw ? kg(r.weightKg, { bodyweight: true }) : `${num(r.weightKg)} kg`}</p>
              </div>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>
            Lo más pesado que levantaste para cada cantidad de reps.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-semibold mb-2">Historial</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                <th className="text-left font-normal pb-1.5">Fecha</th>
                <th className="text-left font-normal pb-1.5">Series</th>
                <th className="text-right font-normal pb-1.5">1RM est.</th>
              </tr>
            </thead>
            <tbody>
              {d.history.map((h) => (
                <tr key={h.sessionId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="py-2 font-mono text-xs whitespace-nowrap pr-3">{dayMonth(h.date)}</td>
                  <td className="py-2 font-mono text-xs">
                    {h.line}
                    {h.record && (
                      <span className="ml-2 font-sans text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ background: "color-mix(in srgb, var(--status-warning) 20%, transparent)", color: "var(--status-warning)" }}>
                        Récord
                      </span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-xs text-right whitespace-nowrap">{e1rmText(h.e1rm, bw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export function Records() {
  const { exerciseId } = useParams();
  const { version } = useFisico();
  const listApi = useApi(() => api.getRecords(), [version]);
  const [q, setQ] = useState("");
  const list = listApi.data || [];
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const shown = list.filter((r) => !q || norm(r.name).includes(norm(q)));
  const selected = Number(exerciseId) || list[0]?.exerciseId;

  return (
    <PageTransition>
      <PageBar crumb="Físico · Entrenar" title="Récords">
        <span className="text-xs max-sm:hidden" style={{ color: "var(--text-faint)" }}>
          1RM estimado = peso × (1 + reps ÷ 30) · fórmula de Epley
        </span>
      </PageBar>
      {listApi.data && !list.length ? (
        <Panel>
          <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>
            Todavía no hay récords: aparecen cuando terminás tu primer entreno.{" "}
            <Link to="/fisico/entreno" className="font-semibold" style={{ color: "var(--accent-strong)" }}>
              Empezar entreno
            </Link>
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
          <Panel className="lg:border-r">
            <label className="relative block mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio…" aria-label="Buscar ejercicio" className="w-full h-10 rounded-lg pl-9 pr-3 text-sm" />
            </label>
            <ul className="space-y-1.5 max-lg:flex max-lg:gap-2 max-lg:space-y-0 max-lg:overflow-x-auto no-scrollbar">
              {shown.map((r) => {
                const on = r.exerciseId === selected;
                return (
                  <li key={r.exerciseId} className="max-lg:shrink-0 max-lg:w-56">
                    <Link to={`/fisico/records/${r.exerciseId}`} replace className="card-hover flex items-center gap-3 rounded-xl p-3" style={{ border: `1px solid ${on ? "var(--accent)" : "transparent"}`, background: on ? "var(--accent-soft)" : undefined }}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold truncate">{r.name}</span>
                        <span className="flex items-center gap-1 text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                          {r.primaryMuscle && muscleLabel(r.primaryMuscle)}
                          {r.priority && <Star size={10} fill="currentColor" style={{ color: "var(--status-warning)" }} />} · {e1rmText(r.bestE1rm?.value, r.isBodyweight)}
                        </span>
                      </span>
                      <Sparkline values={r.sparkline} />
                      <span className="font-mono text-xs w-11 text-right" style={{ color: r.changePct > 0 ? "var(--accent-strong)" : r.changePct < 0 ? "var(--status-warning)" : "var(--text-faint)" }}>
                        {r.changePct == null ? "" : `${signed(r.changePct, { max: 0 })}%`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel>{selected ? <RecordDetail exerciseId={selected} /> : null}</Panel>
        </div>
      )}
    </PageTransition>
  );
}
