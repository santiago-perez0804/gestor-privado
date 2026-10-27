import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { api } from "../../lib/api.js";
import { MUSCLE_IDS, EQUIPMENT } from "../../lib/fisico/index.js";
import { muscleLabel } from "../../lib/fisico/labels.js";
import { field, label } from "./bits.jsx";

const ERRORS = { name_taken: "Ya hay un ejercicio con ese nombre.", primary_muscle_required: "Marcá al menos un músculo principal.", muscles_required: "Elegí los músculos que trabaja.", name_required: "Falta el nombre." };

/**
 * Alta (o edición) de un ejercicio propio: nombre, equipo, barra, si es de peso corporal y los
 * músculos (tocar una vez = secundario ½, dos veces = principal 1, tres = quitar).
 */
export function ExerciseFormModal({ initial = {}, onClose, onSaved }) {
  const editing = !!initial.id;
  const [form, setForm] = useState({
    name: initial.name ?? "",
    equipment: initial.equipment ?? "mancuernas",
    bar: initial.bar ?? "olimpica",
    isBodyweight: initial.isBodyweight ?? false,
    notes: initial.notes ?? "",
  });
  const [muscles, setMuscles] = useState(() => Object.fromEntries((initial.muscles || []).map((m) => [m.muscle, m.role])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const cycle = (m) => setMuscles((cur) => ({ ...cur, [m]: cur[m] === "secondary" ? "primary" : cur[m] === "primary" ? undefined : "secondary" }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = {
      ...form,
      bar: form.equipment === "barra" ? form.bar : null,
      isBodyweight: form.equipment === "peso_corporal" ? true : form.isBodyweight,
      muscles: Object.entries(muscles)
        .filter(([, role]) => role)
        .map(([muscle, role]) => ({ muscle, role })),
    };
    try {
      onSaved(editing ? await api.updateExercise(initial.id, data) : await api.addExercise(data));
      onClose();
    } catch (err) {
      setError(ERRORS[err.message] ?? `No se pudo guardar (${err.message}).`);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="exercise-form-title" width="34rem">
      <form onSubmit={save}>
        <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 id="exercise-form-title" className="text-base font-semibold mr-auto">
            {editing ? "Editar ejercicio" : "Ejercicio propio"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block">
            <span className={label} style={{ color: "var(--text-muted)" }}>
              Nombre
            </span>
            <input value={form.name} onChange={set("name")} className={field} placeholder="Ej. Curl araña" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Equipo
              </span>
              <select value={form.equipment} onChange={set("equipment")} className={field}>
                {Object.entries(EQUIPMENT).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {form.equipment === "barra" ? (
              <label className="block">
                <span className={label} style={{ color: "var(--text-muted)" }}>
                  Barra
                </span>
                <select value={form.bar} onChange={set("bar")} className={field}>
                  <option value="olimpica">Olímpica (20 kg)</option>
                  <option value="z">Z (10 kg)</option>
                </select>
              </label>
            ) : (
              <label className="flex items-center gap-2 text-sm self-end h-10">
                <input type="checkbox" checked={form.equipment === "peso_corporal" || form.isBodyweight} disabled={form.equipment === "peso_corporal"} onChange={set("isBodyweight")} />
                Peso corporal (con lastre)
              </label>
            )}
          </div>
          <fieldset>
            <legend className={label} style={{ color: "var(--text-muted)" }}>
              Músculos · tocá una vez = secundario (½ serie), dos = principal (1 serie)
            </legend>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_IDS.map((m) => {
                const role = muscles[m];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => cycle(m)}
                    aria-pressed={!!role}
                    className="h-9 px-3 rounded-full text-sm"
                    style={{
                      border: `1px solid ${role ? "var(--accent)" : "var(--border)"}`,
                      background: role === "primary" ? "var(--accent)" : role === "secondary" ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
                      color: role === "primary" ? "var(--on-accent)" : role ? "var(--text)" : "var(--text-muted)",
                      fontWeight: role ? 600 : 500,
                    }}
                  >
                    {muscleLabel(m)}
                    {role === "secondary" && " ½"}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="block">
            <span className={label} style={{ color: "var(--text-muted)" }}>
              Notas
            </span>
            <textarea value={form.notes} onChange={set("notes")} rows={2} className="w-full rounded-lg px-3 py-2 text-sm resize-y" />
          </label>
          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="hover-surface h-10 px-4 text-sm" style={{ border: "1px solid var(--border)" }}>
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              {editing ? "Guardar" : "Crear ejercicio"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
