import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Flame, Minus, Plus, Repeat, Trash2 } from "lucide-react";
import { kg, num, parseNum, platesFor } from "../../../lib/fisico/index.js";
import { muscleLabel, restText, rirText } from "../../../lib/fisico/labels.js";
import { ActionsMenu } from "../bits.jsx";

/** "La vez pasada: 8, 8, 7 con 32,5 kg. Hoy buscá 8 en las tres y la próxima subís a 35." */
export function hintText(ex, settings) {
  const s = ex.suggestion;
  const bw = !!ex.exercise?.isBodyweight;
  const w = (v) => (bw ? `${kg(v, { bodyweight: true })} kg de lastre` : `${num(v)} kg`);
  const p = ex.prescription;
  if (!s || s.kind === "start") return `Primera vez: elegí un peso que te deje en ${p.repMin}–${p.repMax} reps${p.rirMin != null ? ` con ${rirText(p.rirMin, p.rirMax)}` : ""}.`;
  const prev = s.previous ? `La vez pasada: ${s.previous.reps.join(", ")} con ${w(s.previous.weightKg)}. ` : "";
  if (s.kind === "increase") return `${prev}Llegaste al tope en todas: hoy subís a ${w(s.weightKg)} y apuntás a ${p.repMin}+.`;
  if (s.kind === "decrease") return `${prev}Dos sesiones bajo el mínimo: hoy bajá a ${w(s.weightKg)} y volvé a construir.`;
  const allTop = s.targetReps.every((r) => r >= p.repMax);
  const step = settings?.progressionStepKg?.[ex.exercise?.equipment] ?? 2.5;
  const n = s.targetReps.length;
  return allTop
    ? `${prev}Hoy buscá ${p.repMax} en ${n === 3 ? "las tres" : `las ${n}`} y la próxima subís a ${w(s.weightKg + step)}.`
    : `${prev}Hoy: mismo peso y ${s.targetReps.join(", ")} reps.`;
}

function NumberCell({ value, onChange, label, disabled, highlight, placeholder }) {
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : value == null ? "" : num(value);
  return (
    <input
      inputMode="decimal"
      enterKeyHint="next"
      value={shown}
      placeholder={placeholder}
      aria-label={label}
      disabled={disabled}
      onFocus={(e) => (setText(value == null ? "" : String(value).replace(".", ",")), setFocused(true), e.target.select())}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseNum(e.target.value);
        if (n != null || e.target.value === "") onChange(n);
      }}
      className="w-full h-12 rounded-xl text-center font-mono text-lg disabled:opacity-100"
      style={{ border: `1px solid ${highlight ? "var(--accent)" : "var(--border)"}`, background: disabled ? "transparent" : undefined }}
    />
  );
}

/**
 * El ejercicio actual: objetivo, pista de progresión y una fila por serie (anterior, kg, reps, RIR y
 * el check de 44 px). Tocar el número de serie la marca como calentamiento ("C").
 */
export function ExerciseCard({ state, exercise: ex, index, total, dispatch, onSwap, onPrev, onNext, newId }) {
  const [showRir, setShowRir] = useState(false);
  const sets = state.sets.filter((s) => s.exerciseKey === ex.key);
  // "Anterior": la misma serie de la vez pasada, por tipo (calentamientos con calentamientos).
  const prevWarm = (ex.previous?.sets || []).filter((x) => x.type === "warmup");
  const prevWork = (ex.previous?.sets || []).filter((x) => x.type !== "warmup");
  const primary = ex.exercise?.muscles?.find((m) => m.role === "primary")?.muscle;
  const isPriority = primary && state.meta?.priorityMuscles?.includes(primary);
  const firstPending = sets.find((s) => !s.completedAt)?.id;
  const p = ex.prescription || {};
  const plates = platesFor(ex.exercise, sets.find((s) => !s.completedAt && s.type === "working")?.weightKg ?? sets.at(-1)?.weightKg, state.settings);
  let working = 0;
  let warm = 0;

  return (
    <section className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: isPriority ? "var(--status-warning)" : "var(--accent-strong)" }}>
            Ejercicio {index + 1} de {total}
            {primary && ` · ${muscleLabel(primary)}`}
            {isPriority && " ★"}
          </p>
          <h2 className="text-2xl font-semibold leading-tight mt-1">{ex.exercise?.name}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Objetivo {p.sets} × {p.repMin === p.repMax ? p.repMin : `${p.repMin}–${p.repMax}`}
            {rirText(p.rirMin, p.rirMax) && ` · ${rirText(p.rirMin, p.rirMax)}`} · descanso {restText(p.restSeconds ?? 90)}
          </p>
        </div>
        <ActionsMenu
          label="Opciones del ejercicio"
          items={[
            { label: "Cambiar ejercicio", icon: Repeat, onClick: onSwap },
            { label: "Agregar calentamiento", icon: Flame, onClick: () => dispatch({ type: "addSet", exerciseKey: ex.key, setType: "warmup", id: newId() }) },
            { label: showRir ? "Ocultar RIR" : "Anotar RIR", icon: Plus, onClick: () => setShowRir((v) => !v) },
            { label: "Quitar ejercicio", icon: Trash2, danger: true, onClick: () => dispatch({ type: "removeExercise", key: ex.key }) },
          ]}
        />
      </div>

      <p className="text-sm leading-relaxed rounded-xl px-3.5 py-3 mt-3" style={{ background: "var(--surface-alt)" }}>
        {hintText(ex, state.settings)}
      </p>

      <div className={`grid ${showRir ? "grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_3.5rem_3.25rem_3rem]" : "grid-cols-[2.25rem_minmax(0,1fr)_5rem_4rem_3rem]"} gap-2 items-center mt-4 text-xs`} style={{ color: "var(--text-faint)" }}>
        <span>Serie</span>
        <span>Anterior</span>
        <span className="text-center">{ex.exercise?.isBodyweight ? "Lastre" : "kg"}</span>
        <span className="text-center">Reps</span>
        {showRir && <span className="text-center">RIR</span>}
        <span />
      </div>
      <ol className="mt-1.5 space-y-1.5">
        {sets.map((s) => {
          const done = !!s.completedAt;
          const label = s.type === "warmup" ? "C" : String(++working);
          const before = s.type === "warmup" ? prevWarm[warm++] : prevWork[working - 1];
          const active = s.id === firstPending;
          return (
            <li key={s.id} className={`grid ${showRir ? "grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_3.5rem_3.25rem_3rem]" : "grid-cols-[2.25rem_minmax(0,1fr)_5rem_4rem_3rem]"} gap-2 items-center rounded-xl -mx-1.5 px-1.5 py-0.5`} style={{ background: active ? "color-mix(in srgb, var(--accent) 7%, transparent)" : undefined }}>
              <button onClick={() => dispatch({ type: "toggleWarmup", setId: s.id })} disabled={done} className="h-11 font-mono text-base font-semibold text-left" style={{ color: s.type === "warmup" ? "var(--status-warning)" : "var(--text)" }} aria-label={s.type === "warmup" ? "Calentamiento: tocá para que sea de trabajo" : `Serie ${label}: tocá para marcarla de calentamiento`}>
                {label}
              </button>
              <span className="font-mono text-sm truncate" style={{ color: "var(--text-faint)" }}>
                {before ? `${kg(before.weightKg, { bodyweight: ex.exercise?.isBodyweight })} × ${before.reps}` : "—"}
              </span>
              <NumberCell value={s.weightKg} disabled={done} highlight={active} label={`Kilos de la serie ${label}`} onChange={(v) => dispatch({ type: "edit", setId: s.id, field: "weightKg", value: v })} placeholder="kg" />
              <NumberCell value={s.reps} disabled={done} highlight={active} label={`Repeticiones de la serie ${label}`} onChange={(v) => dispatch({ type: "edit", setId: s.id, field: "reps", value: v == null ? null : Math.round(v) })} placeholder="reps" />
              {showRir && <NumberCell value={s.rir} disabled={done} label={`RIR de la serie ${label}`} onChange={(v) => dispatch({ type: "edit", setId: s.id, field: "rir", value: v })} placeholder="–" />}
              <button
                onClick={() => dispatch({ type: "toggleDone", setId: s.id })}
                aria-pressed={done}
                aria-label={done ? `Serie ${label} hecha: tocá para destildar` : `Marcar la serie ${label} como hecha`}
                disabled={!done && !(s.reps > 0)}
                className="h-12 w-12 rounded-xl flex items-center justify-center disabled:opacity-40"
                style={done ? { background: "var(--accent)", color: "var(--on-accent)" } : { border: "1px solid var(--border)", color: "var(--text-muted)" }}
              >
                <Check size={22} strokeWidth={done ? 3 : 2} />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => dispatch({ type: "addSet", exerciseKey: ex.key, id: newId() })} className="flex items-center gap-1.5 h-11 px-3.5 rounded-xl text-sm font-semibold" style={{ border: "1px dashed var(--border)" }}>
          <Plus size={16} /> Serie
        </button>
        {sets.some((s) => !s.completedAt) && (
          <button onClick={() => dispatch({ type: "removeSet", setId: [...sets].reverse().find((s) => !s.completedAt).id })} aria-label="Quitar la última serie pendiente" className="flex items-center justify-center h-11 w-11 rounded-xl" style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
            <Minus size={16} />
          </button>
        )}
        {plates && (
          <p className="ml-auto text-xs text-right" style={{ color: "var(--text-muted)" }}>
            Discos por lado:{" "}
            <span className="font-mono" style={{ color: "var(--text)" }}>
              {plates.perSide.length ? plates.perSide.map((x) => num(x)).join(" + ") : "sin discos"}
            </span>
            {!plates.exact && !plates.belowBar && ` (≈ ${num(plates.loadedKg)} kg)`} · barra {plates.bar === "z" ? "Z" : "olímpica"}
          </p>
        )}
      </div>

      <div className="flex justify-between mt-3">
        <button onClick={onPrev} disabled={index === 0} className="hover-surface flex items-center gap-1 h-11 px-3 text-sm disabled:opacity-30" style={{ color: "var(--text-muted)" }}>
          <ChevronLeft size={16} /> Anterior
        </button>
        <button onClick={onNext} disabled={index === total - 1} className="hover-surface flex items-center gap-1 h-11 px-3 text-sm disabled:opacity-30" style={{ color: "var(--text-muted)" }}>
          Siguiente <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
