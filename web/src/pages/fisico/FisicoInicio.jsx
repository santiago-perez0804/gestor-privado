import { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Check, Pencil, Play, Plus, Ruler, Trophy, X } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { Panel, SectionTitle } from "../../components/common/Section.jsx";
import { MuscleChip } from "../../components/fisico/bits.jsx";
import { LineChart } from "../../components/fisico/charts.jsx";
import { extraColor } from "../../components/fisico/WeekScheduleEditor.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { kg, localDateTime, num, parseNum, signed, typoCheck } from "../../lib/fisico/index.js";
import { muscleLabel, nextText, lastText } from "../../lib/fisico/labels.js";
import { useFisico } from "./FisicoContext.jsx";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const SHORT_WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const wd = (d) => new Date(`${d}T12:00:00`).getDay();
const short = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}`;
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const TONE = { good: "var(--accent-strong)", warn: "var(--status-warning)", neutral: "var(--text-muted)" };
const STATUS = {
  done: { label: "Hecho", color: "var(--accent-strong)" },
  today: { label: "Hoy", color: "var(--accent-strong)" },
  tomorrow: { label: "Mañana", color: "var(--text)" },
  pending: { label: "", color: "var(--text-muted)" },
  skipped: { label: "Salteado", color: "var(--status-warning)" },
  moved: { label: "", color: "var(--text-faint)" },
  rest: { label: "", color: "var(--text-faint)" },
};

/** Tira de la semana: un casillero por día con la rutina, actividades y el estado. */
function WeekStrip({ week }) {
  return (
    <div className="no-scrollbar grid grid-flow-col auto-cols-[minmax(6.75rem,1fr)] gap-2 overflow-x-auto max-lg:-mx-4 max-lg:px-4 pb-1">
      {week.days.map((d) => {
        const st = STATUS[d.status];
        const label = d.status === "moved" && d.movedTo ? `→ ${SHORT_WD[wd(d.movedTo)].toLowerCase()}` : d.movedFrom && d.status !== "done" ? `Movida del ${SHORT_WD[wd(d.movedFrom)].toLowerCase()}` : st.label;
        const highlight = d.status === "today" || d.status === "tomorrow";
        const names = d.status === "done" ? d.doneNames : d.routineName ? [d.routineName] : [];
        return (
          <div key={d.date} className="rounded-xl p-2.5 flex flex-col gap-1 min-h-[6.5rem]" style={{ border: `1px solid ${highlight ? "var(--accent)" : "var(--border)"}`, background: "var(--surface)", opacity: d.status === "moved" ? 0.6 : 1 }}>
            <span className="flex justify-between text-xs" style={{ color: highlight ? "var(--accent-strong)" : "var(--text-muted)" }}>
              <b>{SHORT_WD[wd(d.date)]}</b>
              <span className="font-mono">{Number(d.date.slice(8, 10))}</span>
            </span>
            {d.extras.map((x) => (
              <span key={x} className="flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: extraColor(x) }} />
                {cap(x)}
              </span>
            ))}
            {names.map((n, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs font-semibold" style={{ textDecoration: d.status === "moved" ? "line-through" : undefined }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                {n}
              </span>
            ))}
            {!names.length && !d.extras.length && (
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                Descanso
              </span>
            )}
            {label && (
              <span className="mt-auto text-[11px] font-semibold" style={{ color: st.color }}>
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** "Mañana · martes": la rutina que toca y qué intentar en cada ejercicio. */
function NextWorkout({ next, today }) {
  const when = next.status === "today" ? "Hoy" : next.status === "tomorrow" ? "Mañana" : cap(WEEKDAYS[wd(next.date)]);
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] rounded-2xl p-4 mt-3" style={{ background: "var(--surface-alt)" }}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent-strong)" }}>
          {when} · {WEEKDAYS[wd(next.date)]}
          {next.movedFrom && ` (movida del ${WEEKDAYS[wd(next.movedFrom)]})`}
        </p>
        <p className="text-2xl font-semibold mt-1">{next.name}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {next.exerciseCount} ejercicios · {next.setCount} series · ≈ {next.estimatedMinutes} min
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {next.muscles.map((m) => (
            <MuscleChip key={m.muscle} muscle={m.muscle} priority={m.priority} />
          ))}
        </div>
        {next.extras.length > 0 && (
          <p className="text-xs mt-2.5" style={{ color: "var(--text-muted)" }}>
            Ese día también: {next.extras.join(", ")}
          </p>
        )}
        {next.date === today && (
          <Link to={`/fisico/entreno?rutina=${next.routineId}`} className="inline-flex items-center gap-1.5 h-10 px-4 mt-3 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Play size={15} /> Empezar
          </Link>
        )}
      </div>
      <div>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Qué intentar {next.status === "tomorrow" ? "mañana" : next.status === "today" ? "hoy" : "esa vez"}
        </p>
        {next.tryList.length ? (
          <ul className="space-y-2">
            {next.tryList.map((t) => {
              const n = nextText(t.next, { isBodyweight: t.isBodyweight });
              return (
                <li key={t.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-baseline text-sm">
                  <span className="font-semibold truncate">{t.name}</span>
                  <span className="font-mono text-xs" style={{ color: "var(--text-faint)" }}>
                    {lastText(t.last, { isBodyweight: t.isBodyweight })}
                  </span>
                  <span className="font-mono text-xs font-semibold" style={{ color: n.tone === "up" ? "var(--accent-strong)" : undefined }}>
                    {n.text}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Es la primera vez con esta rutina: elegí pesos que te dejen dentro del rango de reps.
          </p>
        )}
        <p className="text-[11px] mt-3" style={{ color: "var(--text-faint)" }}>
          Doble progresión: cuando llegás al tope de reps en todas las series, sube el peso.
        </p>
      </div>
    </div>
  );
}

function WeightCard({ w, onSaved }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const v = parseNum(value);
  const typo = typoCheck(v, w.current, w.typoJumpKg);
  const save = async (e) => {
    e.preventDefault();
    if (!(v > 20)) return;
    setBusy(true);
    try {
      await api.addWeight({ weight: v, recordedAt: localDateTime(new Date()) });
      setValue("");
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  const g = w.goal;
  const p = w.projection;
  const done = g && w.goal.startKg ? Math.min(1, Math.max(0, (g.startKg - w.current) / (g.startKg - g.target))) : null;
  return (
    <div>
      <SectionTitle to="/fisico/peso" action="Ver progreso">
        Peso
      </SectionTitle>
      {w.current != null ? (
        <>
          <p>
            <span className="font-mono text-4xl font-semibold">{num(w.current, { decimals: 1 })}</span>
            <span className="text-sm ml-1.5" style={{ color: "var(--text-muted)" }}>
              kg de tendencia
            </span>
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Última pesada: <b className="font-mono">{num(w.last.kg, { decimals: 1 })}</b> el {short(w.last.day)}
            {w.rate && (
              <>
                {" "}
                · <span style={{ color: w.rate.kgPerWeek < 0 ? "var(--accent-strong)" : undefined }}>{signed(w.rate.kgPerWeek, { max: 2 })} kg por semana</span>
              </>
            )}
          </p>
          {w.chart.trend.length > 1 && (
            <LineChart
              ariaLabel="Peso de las últimas semanas"
              height={120}
              series={[
                { points: w.chart.weighIns, color: "var(--text-faint)", line: false, dots: true, dotSize: 2.5 },
                { points: w.chart.trend, color: "var(--accent)", width: 2.5 },
              ]}
              yFormat={(y) => num(y, { max: 0 })}
            />
          )}
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Registrá tu primera pesada.
        </p>
      )}
      {g && (
        <div className="rounded-xl p-3 mt-2" style={{ background: "var(--surface-alt)" }}>
          <div className="flex justify-between text-xs">
            <span style={{ color: "var(--text-muted)" }}>Meta</span>
            <span>
              <b className="font-mono">{num(g.target)} kg</b>
              {w.current != null && !p?.reached && <span style={{ color: "var(--text-muted)" }}> · faltan {num(Math.abs(w.current - g.target), { max: 1 })}</span>}
            </span>
          </div>
          {done != null && (
            <span className="block h-1.5 rounded-full mt-2" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
              <span className="block h-full rounded-full" style={{ width: `${done * 100}%`, background: "var(--accent)" }} />
            </span>
          )}
          <p className="text-xs mt-2" style={{ color: w.neededStatus === "fast" ? "var(--status-warning)" : "var(--text-muted)" }}>
            {p?.reached
              ? "¡Llegaste a la meta!"
              : [p?.etaDate && `A este ritmo llegás a fines de ${MONTHS[Number(p.etaDate.slice(5, 7)) - 1]}.`, g.targetDate && p?.neededKgPerWeek != null && `Para el ${short(g.targetDate)} necesitás ≈ ${num(Math.abs(p.neededKgPerWeek), { max: 2 })} kg por semana.`].filter(Boolean).join(" ") || "Poné una fecha en Peso para ver qué ritmo necesitás."}
          </p>
        </div>
      )}
      <form onSubmit={save} className="flex gap-2 mt-3">
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="Peso de hoy (kg)" aria-label="Peso de hoy en kilos" className="flex-1 min-w-0 h-10 rounded-lg px-3 text-sm font-mono" />
        <button disabled={busy} className="h-10 px-4 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          Guardar
        </button>
      </form>
      {typo.suspicious && (
        <p className="text-xs mt-1.5" style={{ color: "var(--status-warning)" }}>
          Son {num(Math.abs(typo.diff), { max: 1 })} kg {typo.diff > 0 ? "más" : "menos"} que tu tendencia: ¿está bien? (se guarda igual)
        </p>
      )}
    </div>
  );
}

/** Series por músculo: barra de hechas sobre planificadas, con la banda de referencia. */
function VolumeBars({ volume }) {
  const max = Math.max(volume.range.max + 2, ...volume.rows.map((r) => Math.max(r.planned, r.done)));
  const pct = (v) => `${(v / max) * 100}%`;
  const LABEL = { low: "Bajo", in_range: "En rango", high: "Alto" };
  return (
    <ul className="space-y-2">
      {volume.rows.map((r) => (
        <li key={r.muscle} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_5.5rem] items-center gap-3 text-sm">
          <span className="flex items-center gap-1 truncate">
            {muscleLabel(r.muscle)}
            {r.priority && <span style={{ color: "var(--status-warning)" }}>★</span>}
          </span>
          <span className="relative h-2.5 rounded-full" style={{ background: "color-mix(in srgb, var(--text) 6%, transparent)" }}>
            <span className="absolute top-0 bottom-0" style={{ left: pct(volume.range.min), width: pct(volume.range.max - volume.range.min), background: "color-mix(in srgb, var(--text) 7%, transparent)" }} />
            <span className="absolute top-0 bottom-0 left-0 rounded-full" style={{ width: pct(r.planned), background: "color-mix(in srgb, var(--accent) 30%, transparent)" }} />
            <span className="absolute top-0 bottom-0 left-0 rounded-full" style={{ width: pct(r.done), background: "var(--accent)" }} />
          </span>
          <span className="text-right text-xs">
            <span className="font-mono">
              {num(r.done)}/{num(r.planned)}
            </span>{" "}
            <span style={{ color: r.status === "in_range" ? "var(--text-muted)" : "var(--status-warning)" }}>{LABEL[r.status]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Habits({ data, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const toggle = async (h) => (await api.toggleHabit(h.id, { done: !h.doneToday }), onChanged());
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold">Hábitos de hoy</h2>
        <span className="flex items-center gap-2">
          <span className="font-mono text-sm">
            {data.doneToday} / {data.habits.length}
          </span>
          <button onClick={() => setEditing((v) => !v)} aria-label="Editar hábitos" className="hover-surface w-8 h-8 flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
            {editing ? <X size={14} /> : <Pencil size={13} />}
          </button>
        </span>
      </div>
      <ul className="space-y-2.5">
        {data.habits.map((h) => (
          <li key={h.id} className="flex items-center gap-3">
            <button onClick={() => toggle(h)} aria-pressed={h.doneToday} aria-label={`${h.name}: ${h.doneToday ? "hecho" : "sin hacer"}`} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={h.doneToday ? { background: "var(--accent)", color: "var(--on-accent)" } : { border: "1.5px solid var(--border)" }}>
              {h.doneToday && <Check size={16} strokeWidth={3} />}
            </button>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold truncate">{h.name}</span>
              {h.targetLabel && (
                <span className="block text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                  {h.targetLabel}
                </span>
              )}
            </span>
            <span className="flex gap-0.5" aria-label={`Últimos 7 días: ${h.week.filter((x) => x.done).length}`}>
              {h.week.map((x) => (
                <span key={x.day} className="w-2 h-2 rounded-sm" style={{ background: x.done ? "var(--accent)" : "color-mix(in srgb, var(--text) 12%, transparent)" }} />
              ))}
            </span>
            {editing && (
              <button onClick={async () => (await api.updateHabit(h.id, { archived: true }), onChanged())} aria-label={`Quitar ${h.name}`} className="hover-surface w-8 h-8 flex items-center justify-center" style={{ color: "var(--danger)" }}>
                <X size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await api.addHabit({ name, targetLabel: target });
            setName("");
            setTarget("");
            onChanged();
          }}
          className="flex gap-2 mt-3"
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hábito" className="flex-1 min-w-0 h-9 rounded-lg px-2 text-sm" aria-label="Nombre del hábito" />
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Meta (ej. 2 litros)" className="flex-1 min-w-0 h-9 rounded-lg px-2 text-sm" aria-label="Meta" />
          <button aria-label="Agregar hábito" className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Plus size={15} />
          </button>
        </form>
      )}
      {(data.best || data.worst) && (
        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          {data.best && (
            <>
              {data.best.name}: <b>{data.best.streak === 1 ? "1 día seguido" : `${data.best.streak} días seguidos`}</b>.{" "}
            </>
          )}
          {data.worst && data.worst.id !== data.best?.id && (
            <>
              {data.worst.name} es la que más se te cae: {data.worst.doneLast7} de los últimos 7 días.
            </>
          )}
        </p>
      )}
    </div>
  );
}

export function FisicoInicio() {
  const { version, bump } = useFisico();
  const homeApi = useApi(() => api.getFisicoHome(), [version]);
  const h = homeApi.data;
  if (!h) return null;
  const t = h.today;
  const crumb = [`Físico · ${WEEKDAYS[wd(t)]} ${Number(t.slice(8, 10))} de ${MONTHS[Number(t.slice(5, 7)) - 1]}`, h.plan?.currentWeek && `semana ${h.plan.currentWeek}${h.plan.weeks ? ` de ${h.plan.weeks}` : ""} del plan${h.plan.isDeloadWeek ? " (descarga)" : ""}`].filter(Boolean).join(" · ");
  const short_ = h.volume?.short ?? [];
  return (
    <PageTransition>
      <PageBar crumb={crumb} title="Inicio">
        <Link to="/fisico/peso" className="hover-surface flex items-center gap-1.5 h-9 px-3 text-sm" style={{ border: "1px solid var(--border)" }}>
          <Plus size={15} /> Registrar peso
        </Link>
        <Link to={h.next && h.next.date === t ? `/fisico/entreno?rutina=${h.next.routineId}` : "/fisico/entreno"} className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Play size={15} /> {h.next && h.next.date === t ? `Empezar ${h.next.name}` : "Empezar entreno"}
        </Link>
      </PageBar>

      <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
        <Panel className="lg:border-r lg:border-b">
          {h.week ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="text-[15px] font-semibold">Esta semana</h2>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <b style={{ color: "var(--text)" }}>{h.week.done}</b> de {h.week.planned} entrenos · racha de <b style={{ color: "var(--text)" }}>{h.week.streak}</b> {h.week.streak === 1 ? "semana cumplida" : "semanas cumplidas"}
                </span>
              </div>
              <WeekStrip week={h.week} />
              {h.next && <NextWorkout next={h.next} today={t} />}
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Armá tu plan para ver la semana.{" "}
              <Link to="/fisico/plan" className="font-semibold" style={{ color: "var(--accent-strong)" }}>
                Plan y rutinas
              </Link>
            </p>
          )}
        </Panel>
        <Panel className="lg:border-b">
          <WeightCard w={h.weight} onSaved={bump} />
        </Panel>

        <Panel className="lg:border-r lg:border-b">
          {h.volume && h.volume.rows.length ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <h2 className="text-[15px] font-semibold">Series por músculo esta semana</h2>
                <span className="flex gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--accent)" }} /> Hechas
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "color-mix(in srgb, var(--accent) 30%, transparent)" }} /> Planificadas
                  </span>
                  <span>
                    Referencia {h.volume.range.min}–{h.volume.range.max}
                  </span>
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>
                Las series indirectas cuentan como media: un remo suma ½ serie de bíceps.
              </p>
              <VolumeBars volume={h.volume} />
              {short_.length > 0 && (
                <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
                  {short_.map((m) => muscleLabel(m.muscle).toLowerCase()).join(", ")} {short_.length === 1 ? "queda corto" : "quedan cortos"} en el plan.{" "}
                  <Link to="/fisico/plan" className="font-semibold" style={{ color: "var(--accent-strong)" }}>
                    Ajustar el plan
                  </Link>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Cargá ejercicios en tus rutinas para ver las series por músculo.
            </p>
          )}
        </Panel>
        <Panel className="lg:border-b">
          <Habits data={h.habits} onChanged={bump} />
        </Panel>

        <Panel className="lg:border-r">
          <h2 className="text-[15px] font-semibold">¿Está funcionando la recomposición?</h2>
          <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>
            Bajando grasa y ganando músculo, la balanza sola engaña. Mirá las cuatro señales juntas · últimas 4 semanas
          </p>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
            {h.signals.map((s) => (
              <div key={s.id} className="rounded-xl p-3.5" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {s.label}
                </p>
                <p className="mt-1">
                  <span className="font-mono text-2xl font-semibold">{s.value == null ? "—" : signed(s.value, { max: 1 })}</span>
                  {s.value != null && (
                    <span className="text-xs ml-1" style={{ color: "var(--text-faint)" }}>
                      {s.unit}
                    </span>
                  )}
                </p>
                <p className="flex items-center gap-1 text-xs font-semibold mt-1.5" style={{ color: TONE[s.tone] }}>
                  {s.tone === "good" && <Check size={12} />}
                  {s.verdict}
                </p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <SectionTitle to="/fisico/records" action="Ver todos">
            Récords recientes
          </SectionTitle>
          {h.records.length ? (
            <ul className="space-y-2.5">
              {h.records.map((r, i) => (
                <li key={i}>
                  <Link to={`/fisico/records/${r.exerciseId}`} className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--status-warning) 16%, transparent)", color: "var(--status-warning)" }}>
                      <Trophy size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{r.name}</span>
                      <span className="block text-[11px]" style={{ color: "var(--text-faint)" }}>
                        {short(r.date)} · 1RM estimado {r.isBodyweight ? "+" : ""}
                        {num(r.e1rm, { max: 1 })} kg
                      </span>
                    </span>
                    <span className="font-mono text-sm">
                      {kg(r.weightKg, { bodyweight: r.isBodyweight })} × {r.reps}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Sin récords en las últimas semanas.
            </p>
          )}
          <div className="space-y-2 mt-4">
            {[
              { icon: Camera, to: "/fisico/fotos", n: h.nextPhoto, what: "foto", how: "Cada 2 semanas, misma luz y misma hora." },
              { icon: Ruler, to: "/fisico/medidas", n: h.nextMeasurement, what: "medición", how: "En ayunas, con la cinta en el mismo lugar." },
            ].map(({ icon: Icon, to, n, what, how }) => (
              <Link key={what} to={to} className="card-hover flex items-start gap-3 rounded-xl p-3 text-sm" style={{ border: "1px solid var(--border)" }}>
                <Icon size={16} className="shrink-0 mt-0.5" style={{ color: n.overdue || n.daysLeft === 0 ? "var(--status-warning)" : "var(--accent)" }} />
                <span>
                  <b>{n.never ? `Primera ${what}: cuando quieras.` : n.overdue ? `Ya toca la ${what}.` : n.daysLeft === 0 ? `Hoy toca la ${what}.` : `Próxima ${what} en ${n.daysLeft} ${n.daysLeft === 1 ? "día" : "días"}.`}</b> {how}
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </PageTransition>
  );
}
