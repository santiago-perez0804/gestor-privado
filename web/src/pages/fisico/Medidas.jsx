import { useState } from "react";
import { CalendarDays, Star, Trash2 } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { Panel } from "../../components/common/Section.jsx";
import { LineChart, Sparkline } from "../../components/fisico/charts.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { daysBetween, num, parseNum, signed, localDate } from "../../lib/fisico/index.js";
import { useFisico } from "./FisicoContext.jsx";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const long = (d) => `${Number(d.slice(8, 10))} de ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const short = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}`;
const weekdayLong = (d) => `${WEEKDAYS[new Date(`${d}T12:00:00`).getDay()]} ${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}`;
const VERDICT_COLOR = { good: "var(--accent-strong)", bad: "var(--status-warning)", neutral: "var(--text-muted)", flat: "var(--text-muted)", none: "var(--text-faint)" };
// Qué zona refleja cada músculo prioritario del plan.
const ZONE_MUSCLES = { brazo: ["biceps", "triceps"], pecho: ["pecho"], hombros: ["hombro_lateral", "hombro_anterior", "deltoide_posterior"], muslo: ["cuadriceps", "isquiotibiales", "gluteo"] };

/** Medición guiada: una zona por paso, con dónde medir y el último valor; se guarda todo al final. */
function GuidedMeasure({ zones, onSaved }) {
  const steps = zones.filter((z) => !["cadera"].includes(z.zone) || z.series.length);
  const [i, setI] = useState(0);
  const [values, setValues] = useState({});
  const [date, setDate] = useState(() => localDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const z = steps[i];
  const last = z.series.at(-1)?.cm;
  const isLast = i === steps.length - 1;
  const filled = Object.values(values).filter((v) => parseNum(v) != null).length;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.saveMeasurementSession({ measuredOn: date, values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, parseNum(v)]).filter(([, v]) => v != null)) });
      setValues({});
      setI(0);
      onSaved();
    } catch (err) {
      setError(err.message === "invalid_value" ? "Algún valor no parece en centímetros." : `No se pudo guardar (${err.message}).`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="text-[15px] font-semibold">Medir ahora</h2>
      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
        Zona por zona, con la cinta siempre en el mismo lugar.
      </p>
      <div className="flex gap-1 mt-3" aria-hidden="true">
        {steps.map((s, j) => (
          <span key={s.zone} className="flex-1 h-1.5 rounded-full" style={{ background: j === i ? "var(--accent)" : parseNum(values[s.zone]) != null ? "color-mix(in srgb, var(--accent) 50%, transparent)" : "color-mix(in srgb, var(--text) 12%, transparent)" }} />
        ))}
      </div>
      <div className="rounded-2xl p-4 mt-3" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          Paso {i + 1} de {steps.length}
        </p>
        <h3 className="text-xl font-semibold mt-0.5">{z.label}</h3>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {z.how}
        </p>
        <label className="block mt-3">
          <span className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
            Medida en cm{last != null ? ` · la última fue ${num(last)}` : ""}
          </span>
          <input
            key={z.zone}
            autoFocus
            inputMode="decimal"
            value={values[z.zone] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [z.zone]: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), isLast ? filled && save() : setI(i + 1))}
            placeholder={last != null ? num(last) : "cm"}
            aria-label={`${z.label} en centímetros`}
            className="w-full h-12 rounded-xl px-3 text-lg font-mono"
          />
        </label>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 mt-3">
          <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="h-11 px-4 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ border: "1px solid var(--border)" }}>
            Anterior
          </button>
          {isLast ? (
            <button onClick={save} disabled={busy || !filled} className="h-11 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              Guardar medición ({filled})
            </button>
          ) : (
            <button onClick={() => setI(i + 1)} className="h-11 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              Siguiente: {steps[i + 1].label}
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 rounded-md px-2 text-xs" />
        </label>
        {error && (
          <p className="text-sm mt-2" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
      <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
        Mismo día y hora, en ayunas. Si podés, que te mida la misma persona. Si una zona no la medís, dejala vacía.
      </p>
    </div>
  );
}

function HeightCard({ ratio, ok, heightCm, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [h, setH] = useState(heightCm ?? "");
  const save = async () => {
    await api.saveFisicoSettings({ heightCm: parseNum(h) });
    setEditing(false);
    onSaved();
  };
  if (!heightCm || editing)
    return (
      <div className="rounded-xl p-4" style={{ border: "1px dashed var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Cintura ÷ altura
        </p>
        <p className="text-base font-semibold mt-1">{heightCm ? "Cambiar altura" : "Falta tu altura"}</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
          Indicador de salud simple: por debajo de 0,5 es lo recomendado.
        </p>
        {editing ? (
          <div className="flex items-center gap-2 mt-2">
            <input value={h} onChange={(e) => setH(e.target.value)} inputMode="decimal" placeholder="cm" aria-label="Altura en cm" className="h-9 w-20 rounded-lg px-2 text-sm font-mono" />
            <button onClick={save} className="h-9 px-3 rounded-lg text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              Guardar
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="ghost-action text-sm font-semibold mt-2 px-1 -mx-1" style={{ color: "var(--accent-strong)" }}>
            Cargar altura
          </button>
        )}
      </div>
    );
  return (
    <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Cintura ÷ altura
      </p>
      <p className="font-mono text-2xl font-semibold mt-1" style={{ color: ok == null ? undefined : ok ? "var(--accent-strong)" : "var(--status-warning)" }}>
        {ratio != null ? num(ratio, { decimals: 2 }) : "—"}
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
        {ok == null ? "Falta medir la cintura." : ok ? "Por debajo de 0,5: bien." : "Arriba de 0,5: el objetivo es bajarlo."} Altura {num(heightCm)} cm ·{" "}
        <button onClick={() => setEditing(true)} className="underline">
          cambiar
        </button>
      </p>
    </div>
  );
}

export function Medidas() {
  const { version, bump } = useFisico();
  const sumApi = useApi(() => api.getMeasurements(), [version]);
  const plansApi = useApi(() => api.getFisicoPlans(), [version]);
  const [selected, setSelected] = useState("brazo");
  const s = sumApi.data;
  if (!s) return null;
  const priority = plansApi.data?.find((p) => p.isActive)?.priorityMuscles ?? [];
  const isPriority = (zone) => (ZONE_MUSCLES[zone] || []).some((m) => priority.includes(m));
  const zone = s.zones.find((z) => z.zone === selected) ?? s.zones[0];
  const first = zone.series[0]?.day;
  const r = s.ratios;

  return (
    <PageTransition>
      <PageBar crumb={`Físico · Cuerpo · cada ${s.everyDays === 14 ? "2 semanas" : `${s.everyDays} días`}`} title="Medidas">
        <span className="flex items-center gap-1.5 h-9 px-3 rounded-full text-xs" style={{ border: "1px solid var(--border)", color: s.next.overdue ? "var(--status-warning)" : "var(--text-muted)" }}>
          <CalendarDays size={14} />
          {s.next.never ? "Todavía no mediste" : s.next.overdue ? `Tocaba medir el ${weekdayLong(s.next.date)}` : s.next.daysLeft === 0 ? "Hoy toca medir" : `Próxima medición: ${weekdayLong(s.next.date)}`}
        </span>
      </PageBar>

      <section className="lg:px-7 lg:py-5 lg:border-b">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {s.zones.map((z) => {
            const t = z.trend;
            const on = z.zone === zone.zone;
            const pr = isPriority(z.zone);
            return (
              <button key={z.zone} onClick={() => setSelected(z.zone)} aria-pressed={on} className="card-hover text-left rounded-xl p-3.5" style={{ border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent-soft)" : "var(--surface)" }}>
                <span className="flex items-center justify-between gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {z.label}
                  {pr && (
                    <span className="flex items-center gap-0.5 font-semibold" style={{ color: "var(--status-warning)" }}>
                      <Star size={10} fill="currentColor" /> Prioridad
                    </span>
                  )}
                </span>
                <span className="block mt-1">
                  <span className="font-mono text-2xl font-semibold">{t ? num(t.latest.cm) : "—"}</span>
                  <span className="text-xs ml-1" style={{ color: "var(--text-faint)" }}>
                    cm
                  </span>
                </span>
                <span className="flex items-end justify-between gap-2 mt-1">
                  <span className="font-mono text-xs" style={{ color: VERDICT_COLOR[t?.verdict ?? "none"] }}>
                    {t?.sinceFirst != null ? signed(t.sinceFirst) : t ? "1 medida" : "sin medir"}
                  </span>
                  <Sparkline values={z.series.map((p) => p.cm)} width={56} height={18} color={VERDICT_COLOR[t?.verdict] === "var(--text-faint)" ? "var(--text-muted)" : VERDICT_COLOR[t?.verdict ?? "neutral"]} />
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
          Verde = va hacia donde querés: cintura que baja, brazo, pecho y hombros que suben. Muslo y cuello: neutros.
        </p>
      </section>

      <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] mt-4 lg:mt-0">
        <Panel className="lg:border-r">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-[15px]">
              <b>{zone.label}</b>
              {first && <span style={{ color: "var(--text-muted)" }}> · desde el {long(first)}</span>}
            </h2>
            {zone.trend?.sinceFirst != null && (
              <span className="font-mono text-sm" style={{ color: VERDICT_COLOR[zone.trend.verdict] }}>
                {signed(zone.trend.sinceFirst)} cm
              </span>
            )}
          </div>
          {zone.series.length > 1 ? (
            <LineChart
              ariaLabel={`Evolución de ${zone.label}`}
              series={[{ points: zone.series.map((p) => ({ x: daysBetween(first, p.day), y: p.cm })), color: "var(--accent)", dots: true }]}
              xLabels={[
                { x: 0, label: short(first) },
                { x: daysBetween(first, zone.series.at(-1).day), label: short(zone.series.at(-1).day) },
              ]}
              yFormat={(y) => num(y, { max: 1 })}
              height={200}
            />
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
              Con dos mediciones de {zone.label.toLowerCase()} aparece el gráfico.
            </p>
          )}

          <h2 className="text-[15px] font-semibold mt-6 mb-3">Proporciones</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Hombros ÷ cintura
              </p>
              <p className="mt-1">
                <span className="font-mono text-2xl font-semibold">{r.shouldersToWaist != null ? num(r.shouldersToWaist, { decimals: 2 }) : "—"}</span>
                {r.shouldersToWaistBefore != null && (
                  <span className="font-mono text-xs ml-2" style={{ color: r.shouldersToWaist > r.shouldersToWaistBefore ? "var(--accent-strong)" : "var(--text-muted)" }}>
                    antes {num(r.shouldersToWaistBefore, { decimals: 2 })}
                  </span>
                )}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
                Tu forma de medir la V: sube si crecen hombros o baja cintura.
              </p>
            </div>
            <HeightCard ratio={r.waistToHeight} ok={r.waistToHeightOk} heightCm={s.heightCm} onSaved={bump} />
          </div>

          {s.sessions.length > 0 && (
            <>
              <h2 className="text-[15px] font-semibold mt-6 mb-2">Mediciones</h2>
              <ul>
                {s.sessions.map((ses) => (
                  <li key={ses.id} className="flex items-center gap-3 py-2 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                    <span className="w-16 shrink-0 font-mono text-xs">{short(ses.measuredOn)}</span>
                    <span className="flex-1 min-w-0 truncate" style={{ color: "var(--text-muted)" }}>
                      {Object.entries(ses.values)
                        .map(([zn, v]) => `${s.zones.find((x) => x.zone === zn)?.label ?? zn} ${num(v.valueCm)}`)
                        .join(" · ")}
                    </span>
                    <button onClick={async () => (await api.deleteMeasurementSession(ses.id), bump())} aria-label={`Borrar la medición del ${short(ses.measuredOn)}`} className="hover-surface w-9 h-9 flex items-center justify-center shrink-0" style={{ color: "var(--text-faint)" }}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
        <Panel>
          <GuidedMeasure zones={s.zones} onSaved={bump} />
        </Panel>
      </div>
    </PageTransition>
  );
}
