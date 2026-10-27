import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, CloudOff, Loader2, Plus, Trophy, X } from "lucide-react";
import { api } from "../../../lib/api.js";
import { num, progress } from "../../../lib/fisico/index.js";
import { askNotifications, keepScreenOn, newId, unlockAudio } from "../../../lib/fisico/workoutDevice.js";
import { ExerciseSearch } from "../ExerciseSearch.jsx";
import { ExerciseCard } from "./ExerciseCard.jsx";
import { RestBar } from "./RestBar.jsx";

const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const SYNC_TEXT = {
  saved: "Guardado",
  saving: "Guardando…",
  pending: "Guardado en el celu · se sube solo",
  offline: "Sin conexión · guardado en el celu",
};

/** Panel abajo para agregar o cambiar un ejercicio (buscador de la biblioteca). */
function PickExercise({ title, muscle, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(5,8,7,.6)" }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] min-h-[22rem]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center mb-3">
          <h2 className="text-base font-semibold mr-auto">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="hover-surface w-11 h-11 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>
        <ExerciseSearch onPick={onPick} muscle={muscle} placeholder="Buscar ejercicio…" />
      </div>
    </div>
  );
}

/**
 * El entreno en curso. Una mano, botones de 44 px, pantalla encendida. Todo cambio se guarda en el
 * celular al instante y se sube cuando hay conexión.
 */
export function LiveWorkout({ live, onFinished }) {
  const { state, dispatch, sync } = live;
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [picker, setPicker] = useState(null); // { mode: 'add' } | { mode: 'swap', key, muscle }
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const seenPrs = useRef(state.prs.length);

  useEffect(() => keepScreenOn(), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Récord nuevo: aviso en el momento.
  useEffect(() => {
    if (state.prs.length > seenPrs.current) {
      const pr = state.prs.at(-1);
      const ex = state.exercises.find((e) => e.exerciseId === pr.exerciseId);
      setToast({ name: ex?.exercise?.name, pr, bodyweight: !!ex?.exercise?.isBodyweight });
      const t = setTimeout(() => setToast(null), 5000);
      seenPrs.current = state.prs.length;
      return () => clearTimeout(t);
    }
    seenPrs.current = state.prs.length;
  }, [state.prs, state.exercises]);

  const prog = useMemo(() => progress(state), [state]);
  const idx = Math.max(0, state.exercises.findIndex((e) => e.key === state.current));
  const current = state.exercises[idx];
  const pendingOthers = state.exercises.filter((e, i) => i > idx && !prog.perExercise[i]?.complete);
  const done = state.exercises.filter((e, i) => prog.perExercise[i]?.complete && e.key !== current?.key);
  const elapsed = now - Date.parse(state.session.startedAt);

  const wrapped = (action) => {
    if (action.type === "toggleDone") {
      unlockAudio(); // iOS: el audio se habilita con un toque
      askNotifications();
    }
    dispatch(action);
  };

  async function pick(exercise) {
    setError(null);
    try {
      const data = await api.getWorkoutExercise(exercise.id);
      if (picker.mode === "swap") dispatch({ type: "swapExercise", key: picker.key, exercise: data, newKey: newId(), newId });
      else dispatch({ type: "addExercise", exercise: data, key: newId(), newId });
      setPicker(null);
    } catch (err) {
      setError(`Sin conexión no se puede traer ese ejercicio (${err.message}).`);
    }
  }

  const finish = () => {
    dispatch({ type: "finish" });
    onFinished();
  };
  const pendingCount = prog.total - prog.done;

  return (
    <div className="min-h-dvh pb-40" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2" style={{ background: "var(--bg)" }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/fisico")} aria-label="Minimizar (el entreno sigue)" className="hover-surface w-11 h-11 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
              <ChevronDown size={22} />
            </button>
            <div className="flex-1 min-w-0 text-center">
              <p className="text-base font-semibold truncate">{state.session.title}</p>
              <p className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                {clock(elapsed)} · {prog.done} de {prog.total} series
              </p>
            </div>
            <button onClick={() => setConfirm(true)} className="h-11 px-4 rounded-xl text-sm font-semibold" style={{ background: "var(--surface-alt)" }}>
              Terminar
            </button>
          </div>
          <div className="flex gap-1 mt-2" aria-hidden="true">
            {prog.perExercise.map((p, i) => (
              <button key={p.key} onClick={() => dispatch({ type: "select", key: p.key })} className="flex-1 h-1.5 rounded-full" style={{ background: p.complete ? "var(--accent)" : i === idx ? "color-mix(in srgb, var(--accent) 55%, transparent)" : "color-mix(in srgb, var(--text) 14%, transparent)" }} tabIndex={-1} />
            ))}
          </div>
          <p className="flex items-center justify-center gap-1.5 text-[11px] mt-1.5" style={{ color: sync.status === "offline" || sync.status === "pending" ? "var(--status-warning)" : "var(--text-faint)" }}>
            {sync.status === "saving" ? <Loader2 size={11} className="animate-spin" /> : sync.status === "saved" ? <Check size={11} /> : <CloudOff size={11} />}
            {SYNC_TEXT[sync.status]}
          </p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-3 space-y-4">
        {current ? (
          <ExerciseCard
            key={current.key}
            state={state}
            exercise={current}
            index={idx}
            total={state.exercises.length}
            dispatch={wrapped}
            newId={newId}
            onSwap={() => setPicker({ mode: "swap", key: current.key, muscle: current.exercise?.muscles?.find((m) => m.role === "primary")?.muscle ?? "" })}
            onPrev={() => dispatch({ type: "select", key: state.exercises[idx - 1]?.key })}
            onNext={() => dispatch({ type: "select", key: state.exercises[idx + 1]?.key })}
          />
        ) : (
          <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>
            Entreno libre: agregá el primer ejercicio.
          </p>
        )}

        {pendingOthers.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>
              Lo que sigue
            </h3>
            <ul>
              {pendingOthers.map((e) => {
                const i = state.exercises.indexOf(e);
                const p = e.prescription || {};
                return (
                  <li key={e.key} style={{ borderTop: "1px solid var(--border)" }}>
                    <button onClick={() => dispatch({ type: "select", key: e.key })} className="w-full flex items-center gap-3 py-3 text-left min-h-11">
                      <span className="font-mono text-sm w-5" style={{ color: "var(--text-faint)" }}>
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-medium truncate">{e.exercise?.name}</span>
                        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                          {p.sets} × {p.repMin}–{p.repMax}
                          {e.suggestion?.kind === "increase" ? ` · subís a ${num(e.suggestion.weightKg)} kg` : e.suggestion?.weightKg != null ? ` · ${num(e.suggestion.weightKg)} kg` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {done.length > 0 && (
          <p className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <Check size={15} style={{ color: "var(--accent)" }} /> Hechos: {done.map((e) => e.exercise?.name.toLowerCase()).join(", ")}
          </p>
        )}
        <button onClick={() => setPicker({ mode: "add" })} className="w-full flex items-center justify-center gap-1.5 h-12 rounded-xl text-sm font-semibold" style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
          <Plus size={16} /> Agregar ejercicio
        </button>
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </main>

      {toast && (
        <div className="fixed left-3 right-3 top-[max(5.5rem,calc(env(safe-area-inset-top)+5rem))] z-30 flex justify-center pointer-events-none" role="status">
          <div className="max-w-md w-full flex items-center gap-3 rounded-2xl px-4 py-3 easel-fade" style={{ background: "color-mix(in srgb, var(--status-warning) 22%, var(--surface))", border: "1px solid var(--status-warning)" }}>
            <Trophy size={22} style={{ color: "var(--status-warning)" }} />
            <p className="text-sm">
              <b>¡Récord!</b> {toast.name}: {toast.pr.e1rm ? `1RM estimado ${toast.bodyweight ? "+" : ""}${num(toast.pr.e1rmValue)} kg` : `el mayor peso para ${toast.pr.repsCount} reps`}
            </p>
          </div>
        </div>
      )}

      {!confirm && <RestBar rest={state.rest} onAdjust={(s) => dispatch({ type: "restAdjust", seconds: s })} onSkip={() => dispatch({ type: "restSkip" })} />}

      {picker && <PickExercise title={picker.mode === "swap" ? "Cambiar por…" : "Agregar ejercicio"} muscle={picker.muscle ?? ""} onPick={pick} onClose={() => setPicker(null)} />}

      {confirm && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(5,8,7,.6)" }}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="text-lg font-semibold">{pendingCount > 0 ? `Te quedan ${pendingCount} ${pendingCount === 1 ? "serie" : "series"} sin tildar` : "¿Terminar el entreno?"}</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {pendingCount > 0 ? "Las que no tildaste no cuentan (ni para el volumen ni para los récords)." : `${clock(elapsed)} · ${prog.done} series.`}
            </p>
            <button onClick={finish} className="w-full h-12 rounded-xl text-base font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              Terminar
            </button>
            <button onClick={() => setConfirm(false)} className="w-full h-12 rounded-xl text-base font-semibold" style={{ background: "var(--surface-alt)" }}>
              Seguir entrenando
            </button>
            <button
              onClick={() => {
                dispatch({ type: "discard" });
                onFinished({ discarded: true });
              }}
              className="w-full h-11 text-sm"
              style={{ color: "var(--danger)" }}
            >
              Descartar este entreno
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
