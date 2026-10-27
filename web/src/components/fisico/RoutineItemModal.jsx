import { useEffect, useState } from "react";
import { Loader2, Repeat, Trash2, X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { api } from "../../lib/api.js";
import { parseNum } from "../../lib/fisico/index.js";
import { musclesText, restText } from "../../lib/fisico/labels.js";
import { field, label } from "./bits.jsx";
import { ExerciseSearch } from "./ExerciseSearch.jsx";

const RESTS = [45, 60, 90, 120, 150, 180, 240];
const ERRORS = { repMax_below_repMin: "El máximo de reps no puede ser menor que el mínimo.", rirMax_below_rirMin: "El RIR máximo no puede ser menor que el mínimo." };

/** Prescripción de un ejercicio en la rutina: series, rango de reps, descanso, RIR; cambiarlo o quitarlo. */
export function RoutineItemModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    sets: String(item.sets),
    repMin: String(item.repMin),
    repMax: String(item.repMax),
    restSeconds: item.restSeconds,
    rirMin: item.rirMin ?? "",
    rirMax: item.rirMax ?? "",
    supersetGroup: item.supersetGroup ?? "",
    notes: item.notes ?? "",
  });
  const [exercise, setExercise] = useState(item.exercise);
  const [alternatives, setAlternatives] = useState([]);
  const [swapping, setSwapping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (swapping) api.getExerciseAlternatives(item.exerciseId).then(setAlternatives).catch(() => {});
  }, [swapping, item.exerciseId]);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await fn());
      onClose();
    } catch (err) {
      setError(ERRORS[err.message] ?? `No se pudo guardar (${err.message}).`);
      setBusy(false);
    }
  }

  const save = (e) => {
    e.preventDefault();
    run(() =>
      api.updateRoutineItem(item.id, {
        exerciseId: exercise.id,
        sets: parseNum(form.sets),
        repMin: parseNum(form.repMin),
        repMax: parseNum(form.repMax),
        restSeconds: Number(form.restSeconds),
        rirMin: parseNum(form.rirMin),
        rirMax: parseNum(form.rirMax),
        supersetGroup: form.supersetGroup.trim().toUpperCase() || null,
        notes: form.notes.trim() || null,
      })
    );
  };

  const num = (k, aria, extra = {}) => <input inputMode="decimal" value={form[k]} onChange={set(k)} aria-label={aria} className={`${field} font-mono text-center`} {...extra} />;

  return (
    <Modal onClose={onClose} labelledBy="item-title" width="34rem">
      <form onSubmit={save}>
        <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0 mr-auto">
            <h2 id="item-title" className="text-base font-semibold truncate">
              {exercise.name}
            </h2>
            <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
              {musclesText(exercise.muscles)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {swapping ? (
            <div className="space-y-2.5">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Cambiar por otro del mismo músculo (se mantiene la prescripción):
              </p>
              <div className="flex flex-wrap gap-2">
                {alternatives.map((a) => (
                  <button key={a.id} type="button" onClick={() => (setExercise(a), setSwapping(false))} className="hover-surface h-9 px-3 text-sm" style={{ border: "1px solid var(--border)" }}>
                    {a.name}
                  </button>
                ))}
              </div>
              <ExerciseSearch onPick={(e) => (setExercise(e), setSwapping(false))} placeholder="O buscá otro…" />
            </div>
          ) : (
            <button type="button" onClick={() => setSwapping(true)} className="hover-surface flex items-center gap-1.5 h-9 px-3 text-sm" style={{ border: "1px solid var(--border)" }}>
              <Repeat size={14} /> Cambiar ejercicio
            </button>
          )}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Series
              </span>
              {num("sets", "Series")}
            </label>
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Reps mín.
              </span>
              {num("repMin", "Repeticiones mínimas")}
            </label>
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Reps máx.
              </span>
              {num("repMax", "Repeticiones máximas")}
            </label>
          </div>
          <div>
            <span className={label} style={{ color: "var(--text-muted)" }}>
              Descanso
            </span>
            <div className="flex flex-wrap gap-2">
              {RESTS.map((s) => (
                <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, restSeconds: s }))} aria-pressed={Number(form.restSeconds) === s} className="h-9 px-3 rounded-full text-sm font-mono" style={{ border: `1px solid ${Number(form.restSeconds) === s ? "var(--accent)" : "var(--border)"}`, background: Number(form.restSeconds) === s ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent" }}>
                  {restText(s)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                RIR mín.
              </span>
              {num("rirMin", "RIR mínimo", { placeholder: "—" })}
            </label>
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                RIR máx.
              </span>
              {num("rirMax", "RIR máximo", { placeholder: "—" })}
            </label>
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Superserie
              </span>
              <input value={form.supersetGroup} onChange={set("supersetGroup")} maxLength={2} placeholder="A, B…" className={`${field} text-center uppercase`} aria-label="Grupo de superserie" />
            </label>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            RIR: repeticiones que te quedan en reserva. 1–2 = cerca del fallo sin llegar. Mismo grupo de superserie = se hacen alternados.
          </p>
          <label className="block">
            <span className={label} style={{ color: "var(--text-muted)" }}>
              Notas
            </span>
            <textarea value={form.notes} onChange={set("notes")} rows={2} className="w-full rounded-lg px-3 py-2 text-sm resize-y" placeholder="Agarre, tempo, ajuste de la máquina…" />
          </label>
          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => run(() => api.deleteRoutineItem(item.id))} disabled={busy} className="hover-surface flex items-center gap-1.5 h-10 px-3 text-sm mr-auto" style={{ color: "var(--danger)" }}>
              <Trash2 size={15} /> Quitar
            </button>
            <button type="button" onClick={onClose} className="hover-surface h-10 px-4 text-sm" style={{ border: "1px solid var(--border)" }}>
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
