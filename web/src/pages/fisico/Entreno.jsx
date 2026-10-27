import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Dumbbell, Loader2, Play, RotateCcw, Trophy } from "lucide-react";
import { api } from "../../lib/api.js";
import { doneVolume, initWorkout, fromSavedSession, isDirty, num, workoutReducer } from "../../lib/fisico/index.js";
import { muscleLabel } from "../../lib/fisico/labels.js";
import { clearLocal, loadLocal, newId, push, saveLocal } from "../../lib/fisico/workoutDevice.js";
import { useLiveWorkout } from "../../components/fisico/live/useLiveWorkout.js";
import { LiveWorkout } from "../../components/fisico/live/LiveWorkout.jsx";

/** Si quedó un entreno terminado sin subir (sin señal al terminar), lo sube. Devuelve si subió algo. */
export async function flushFinishedWorkout() {
  const s = loadLocal();
  if (!s || s.session.status === "in_progress") return false;
  const dirty = isDirty(s);
  if (dirty) await push(s);
  clearLocal();
  return dirty;
}

const page = "min-h-dvh px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10";
const bigButton = "w-full flex items-center gap-3 rounded-2xl p-4 text-left min-h-16";

function Shell({ children, back = true }) {
  const navigate = useNavigate();
  return (
    <div className={page} style={{ background: "var(--bg)" }}>
      <div className="max-w-md mx-auto space-y-4">
        {back && (
          <button onClick={() => navigate("/fisico")} className="hover-surface flex items-center gap-1.5 h-11 px-2 text-sm -ml-2" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft size={16} /> Físico
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** Elegir qué entrenar: la rutina que toca hoy primero. */
function ChooseWorkout({ onStart, onResumeServer }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.getWorkoutToday().then(setInfo).catch((e) => setError(e.message));
  }, []);
  if (error) return <Shell><p className="text-sm" style={{ color: "var(--danger)" }}>No se pudo cargar el plan ({error}). Revisá la conexión.</p></Shell>;
  if (!info) return <Shell><Loader2 className="animate-spin mx-auto" /></Shell>;
  const suggested = info.routines.find((r) => r.id === info.suggestedRoutineId);
  const others = info.routines.filter((r) => r.id !== suggested?.id);
  return (
    <Shell>
      <h1 className="text-2xl font-semibold">Empezar entreno</h1>
      {info.inProgress && (
        <button onClick={() => onResumeServer(info.inProgress)} className={bigButton} style={{ background: "color-mix(in srgb, var(--status-warning) 14%, var(--surface))", border: "1px solid var(--status-warning)" }}>
          <RotateCcw size={20} style={{ color: "var(--status-warning)" }} />
          <span>
            <span className="block text-base font-semibold">Retomar {info.inProgress.title}</span>
            <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
              Empezado en otro dispositivo · {info.inProgress.setsDone} de {info.inProgress.setsTotal} series
            </span>
          </span>
        </button>
      )}
      {suggested && (
        <button onClick={() => onStart(suggested.id)} className={bigButton} style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Play size={22} />
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wider opacity-80">Hoy toca</span>
            <span className="block text-xl font-semibold">{suggested.name}</span>
          </span>
        </button>
      )}
      {!suggested && info.doneToday && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Hoy ya entrenaste. Si querés, hacé otra rutina o un entreno libre.
        </p>
      )}
      {!info.routines.length && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Todavía no tenés rutinas en el plan activo.{" "}
          <Link to="/fisico/plan" className="font-semibold" style={{ color: "var(--accent-strong)" }}>
            Armá tu plan
          </Link>{" "}
          o empezá un entreno libre.
        </p>
      )}
      {others.length > 0 && (
        <ul className="space-y-2">
          {others.map((r) => (
            <li key={r.id}>
              <button onClick={() => onStart(r.id)} className={`${bigButton} card-hover`} style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
                <Dumbbell size={18} style={{ color: "var(--text-muted)" }} />
                <span>
                  <span className="block text-base font-semibold">{r.name}</span>
                  <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                    {r.exerciseCount} ejercicios
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => onStart(null)} className={`${bigButton} card-hover justify-center`} style={{ border: "1px dashed var(--border)" }}>
        Entreno libre
      </button>
    </Shell>
  );
}

/** Resumen al terminar: del server si se pudo subir; si no, el calculado en el celular. */
export function Summary({ summary, local }) {
  const navigate = useNavigate();
  const s = summary;
  const minutes = s?.durationMin ?? (local ? Math.round((Date.parse(local.session.endedAt) - Date.parse(local.session.startedAt)) / 60000) : null);
  const byMuscle = s?.byMuscle ?? (local ? doneVolume(local.sets, new Map(local.exercises.map((e) => [e.exerciseId, e.exercise]))) : {});
  const records = s?.records ?? (local ? local.prs.map((p) => ({ name: local.exercises.find((e) => e.exerciseId === p.exerciseId)?.exercise?.name, e1rm: p.e1rm, e1rmValue: p.e1rmValue, weightKg: p.weightKg, reps: p.repsCount })) : []);
  const sets = s?.workingSets ?? local?.sets.filter((x) => x.type === "working" && x.completedAt).length ?? 0;
  const volumeKg = s?.volumeKg ?? Math.round((local?.sets || []).filter((x) => x.type === "working" && x.completedAt).reduce((a, x) => a + (x.weightKg || 0) * (x.reps || 0), 0));
  const muscles = Object.entries(byMuscle).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...muscles.map(([, v]) => v));
  return (
    <Shell back={false}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent-strong)" }}>
        Entreno terminado
      </p>
      <h1 className="text-2xl font-semibold">{s?.title ?? local?.session.title}</h1>
      {!s && (
        <p className="text-sm rounded-xl px-3.5 py-2.5" style={{ background: "color-mix(in srgb, var(--status-warning) 12%, transparent)" }}>
          Quedó guardado en el celu: se sube solo cuando haya conexión.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Duración", minutes != null ? `${minutes} min` : "—"],
          ["Series", sets],
          ["Volumen", `${num(volumeKg)} kg`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {l}
            </p>
            <p className="font-mono text-xl font-semibold mt-1">{v}</p>
          </div>
        ))}
      </div>
      {records.length > 0 && (
        <section className="rounded-2xl p-4 space-y-2" style={{ background: "color-mix(in srgb, var(--status-warning) 12%, var(--surface))", border: "1px solid color-mix(in srgb, var(--status-warning) 40%, transparent)" }}>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Trophy size={16} style={{ color: "var(--status-warning)" }} /> {records.length === 1 ? "Récord nuevo" : `${records.length} récords nuevos`}
          </h2>
          {records.map((r, i) => (
            <p key={i} className="text-sm">
              {r.name}: {num(r.weightKg)} × {r.reps}
              {r.e1rm && ` · 1RM est. ${r.bodyweight ? "+" : ""}${num(r.e1rmValue)} kg`}
            </p>
          ))}
        </section>
      )}
      {muscles.length > 0 && (
        <section className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3">Series por músculo</h2>
          <ul className="space-y-2">
            {muscles.map(([m, v]) => (
              <li key={m} className="grid grid-cols-[7rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-sm">
                <span className="truncate">{muscleLabel(m)}</span>
                <span className="h-2 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: "var(--accent)" }} />
                </span>
                <span className="font-mono text-xs text-right">{num(v)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {s?.comparison && (
        <section className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold">Contra la vez anterior ({s.comparison.date.slice(8, 10)}/{s.comparison.date.slice(5, 7)})</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {s.comparison.workingSets} series · {num(s.comparison.volumeKg)} kg de volumen{s.comparison.durationMin != null ? ` · ${s.comparison.durationMin} min` : ""}
          </p>
          <ul className="space-y-1">
            {s.comparison.perExercise
              .filter((x) => x.e1rmNow != null && x.e1rmBefore != null)
              .map((x) => {
                const diff = x.e1rmNow - x.e1rmBefore;
                return (
                  <li key={x.exerciseId} className="flex justify-between text-sm">
                    <span className="truncate">{x.name}</span>
                    <span className="font-mono" style={{ color: diff > 0 ? "var(--accent-strong)" : diff < 0 ? "var(--status-warning)" : "var(--text-muted)" }}>
                      {diff > 0 ? "+" : diff < 0 ? "−" : "="}
                      {diff ? `${num(Math.abs(diff), { max: 1 })} kg` : ""}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
      <button onClick={() => navigate("/fisico")} className="w-full h-12 rounded-xl text-base font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        Listo
      </button>
    </Shell>
  );
}

function LiveSession({ initial, onFinished }) {
  const live = useLiveWorkout(initial);
  return <LiveWorkout live={live} onFinished={onFinished} />;
}

/** /fisico/entreno — fuera del marco de la app: pantalla completa, pensada para el celular. */
export function Entreno() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("loading"); // loading | resume | choose | live | finishing | summary
  const [initial, setInitial] = useState(null);
  const [local, setLocal] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  async function start(routineId) {
    setPhase("loading");
    setError(null);
    try {
      const data = await api.getWorkoutStart(routineId || undefined);
      const s = initWorkout(data, { now: Date.now(), newId });
      saveLocal(s);
      setInitial(s);
      setPhase("live");
    } catch (err) {
      setError(`No se pudo empezar (${err.message}). Necesitás conexión para empezar; después ya no.`);
      setPhase("choose");
    }
  }

  async function resumeServer(info) {
    setPhase("loading");
    try {
      const saved = await api.getSession(info.id);
      const data = await api.getWorkoutStart(saved.routineId || undefined);
      const missing = [...new Set(saved.sets.map((x) => x.exerciseId))].filter((id) => !data.exercises.some((e) => e.exerciseId === id));
      const extra = new Map(await Promise.all(missing.map(async (id) => [id, await api.getWorkoutExercise(id)])));
      const s = fromSavedSession(data, saved, extra, { newId });
      saveLocal(s);
      setInitial(s);
      setPhase("live");
    } catch (err) {
      setError(`No se pudo retomar (${err.message}).`);
      setPhase("choose");
    }
  }

  useEffect(() => {
    (async () => {
      const saved = loadLocal();
      if (saved?.session.status === "in_progress") {
        setLocal(saved);
        return setPhase("resume");
      }
      // Uno terminado que no se llegó a subir: se sube ahora (si se puede) y se sigue.
      await flushFinishedWorkout().catch(() => {});
      const rutina = params.get("rutina");
      if (rutina || params.get("libre")) return start(rutina);
      setPhase("choose");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finished({ discarded = false } = {}) {
    setPhase("finishing");
    const final = loadLocal(); // ya guardado en el celular por el reducer
    try {
      if (final) await push(final);
      clearLocal();
      if (discarded) return navigate("/fisico");
      setSummary(await api.getSessionSummary(final.session.id));
      setLocal(null);
    } catch {
      if (discarded) return navigate("/fisico");
      setLocal(final);
    }
    setPhase("summary");
  }

  if (phase === "live") return <LiveSession initial={initial} onFinished={finished} />;
  if (phase === "summary") return <Summary summary={summary} local={summary ? null : local} />;
  if (phase === "resume")
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Tenés un entreno en curso</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {local.session.title} · empezado a las {new Date(local.session.startedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {local.sets.filter((x) => x.completedAt).length} series hechas
        </p>
        <button onClick={() => (setInitial(local), setPhase("live"))} className={bigButton} style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Play size={22} /> <span className="text-lg font-semibold">Retomar</span>
        </button>
        <button
          onClick={async () => {
            const discarded = workoutReducer(local, { type: "discard", now: Date.now() });
            saveLocal(discarded);
            await push(discarded).catch(() => {});
            clearLocal();
            setLocal(null);
            setPhase("choose");
          }}
          className="w-full h-12 rounded-xl text-sm"
          style={{ color: "var(--danger)", border: "1px solid var(--border)" }}
        >
          Descartarlo y empezar otro
        </button>
      </Shell>
    );
  if (phase === "choose")
    return (
      <>
        {error && (
          <p className="fixed top-2 inset-x-3 z-10 max-w-md mx-auto text-sm rounded-xl px-3.5 py-2.5" style={{ background: "color-mix(in srgb, var(--danger) 14%, var(--surface))" }}>
            {error}
          </p>
        )}
        <ChooseWorkout onStart={start} onResumeServer={resumeServer} />
      </>
    );
  return (
    <Shell back={false}>
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    </Shell>
  );
}
