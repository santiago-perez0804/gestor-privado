import { useState } from "react";
import { Copy, Loader2, Trash2, X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { api } from "../../lib/api.js";
import { MUSCLE_IDS, EXTRA_ACTIVITIES, parseNum } from "../../lib/fisico/index.js";
import { muscleLabel } from "../../lib/fisico/labels.js";
import { field, label } from "./bits.jsx";

const ERRORS = { name_required: "Falta el nombre.", deload_after_end: "La semana de descarga tiene que estar dentro del plan.", invalid_weeks: "Semanas: entre 1 y 104." };

function Header({ id, title, onClose }) {
  return (
    <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
      <h2 id={id} className="text-base font-semibold mr-auto">
        {title}
      </h2>
      <button type="button" onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
        <X size={18} />
      </button>
    </div>
  );
}

const Toggle = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={on} className="h-9 px-3 rounded-full text-sm" style={{ border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent", color: on ? "var(--text)" : "var(--text-muted)", fontWeight: on ? 600 : 500 }}>
    {children}
  </button>
);

/** Crear o editar el plan: objetivo, duración, descarga, músculos prioritarios y actividades diarias. */
export function PlanFormModal({ plan, onClose, onSaved, onDeleted }) {
  const editing = !!plan?.id;
  const [form, setForm] = useState({
    name: plan?.name ?? "",
    goal: plan?.goal ?? "",
    startDate: plan?.startDate ?? "",
    weeks: plan?.weeks ?? "",
    deloadWeek: plan?.deloadWeek ?? "",
    description: plan?.description ?? "",
  });
  const [priority, setPriority] = useState(plan?.priorityMuscles ?? []);
  const [daily, setDaily] = useState(plan?.dailyExtras ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function run(fn, after) {
    setBusy(true);
    setError(null);
    try {
      const out = await fn();
      after(out);
      onClose();
    } catch (err) {
      setError(ERRORS[err.message] ?? `No se pudo guardar (${err.message}).`);
      setBusy(false);
    }
  }

  const save = (e) => {
    e.preventDefault();
    const data = { ...form, weeks: parseNum(form.weeks), deloadWeek: parseNum(form.deloadWeek), priorityMuscles: priority, dailyExtras: daily };
    run(() => (editing ? api.updateFisicoPlan(plan.id, data) : api.addFisicoPlan(data)), onSaved);
  };

  return (
    <Modal onClose={onClose} labelledBy="plan-form-title" width="36rem">
      <form onSubmit={save}>
        <Header id="plan-form-title" title={editing ? "Editar plan" : "Nuevo plan"} onClose={onClose} />
        <div className="p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Nombre
              </span>
              <input value={form.name} onChange={set("name")} className={field} placeholder="PPL · Recomposición" />
            </label>
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Objetivo
              </span>
              <input value={form.goal} onChange={set("goal")} className={field} placeholder="Bajar grasa y ganar brazo" />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Empieza
              </span>
              <input type="date" value={form.startDate} onChange={set("startDate")} className={field} />
            </label>
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Semanas
              </span>
              <input inputMode="numeric" value={form.weeks} onChange={set("weeks")} className={`${field} font-mono`} placeholder="13" />
            </label>
            <label className="block">
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Descarga (semana)
              </span>
              <input inputMode="numeric" value={form.deloadWeek} onChange={set("deloadWeek")} className={`${field} font-mono`} placeholder="7" />
            </label>
          </div>
          <fieldset>
            <legend className={label} style={{ color: "var(--text-muted)" }}>
              Prioridad (en orden)
            </legend>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_IDS.map((m) => (
                <Toggle key={m} on={priority.includes(m)} onClick={() => toggle(priority, setPriority, m)}>
                  {priority.includes(m) ? `${priority.indexOf(m) + 1}. ` : ""}
                  {muscleLabel(m)}
                </Toggle>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={label} style={{ color: "var(--text-muted)" }}>
              Todos los días
            </legend>
            <div className="flex flex-wrap gap-2">
              {EXTRA_ACTIVITIES.map((x) => (
                <Toggle key={x} on={daily.includes(x)} onClick={() => toggle(daily, setDaily, x)}>
                  {x[0].toUpperCase() + x.slice(1)}
                </Toggle>
              ))}
            </div>
          </fieldset>
          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            {editing &&
              (confirmDelete ? (
                <span className="flex items-center gap-2 mr-auto text-sm">
                  ¿Borrar el plan y sus rutinas?
                  <button type="button" onClick={() => run(() => api.deleteFisicoPlan(plan.id), onDeleted)} className="h-9 px-3 rounded-lg font-semibold" style={{ background: "var(--danger)", color: "#fff" }}>
                    Borrar
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="hover-surface flex items-center gap-1.5 h-10 px-3 text-sm mr-auto" style={{ color: "var(--danger)" }}>
                  <Trash2 size={15} /> Borrar
                </button>
              ))}
            <button type="button" onClick={onClose} className="hover-surface h-10 px-4 text-sm ml-auto" style={{ border: "1px solid var(--border)" }}>
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              {editing ? "Guardar" : "Crear plan"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Duplicar el plan para arrancar un bloque nuevo (rutinas, ejercicios y agenda; sin historial). */
export function DuplicatePlanModal({ plan, onClose, onSaved }) {
  const [name, setName] = useState(`${plan.name} · bloque 2`);
  const [startDate, setStartDate] = useState("");
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(await api.duplicatePlan(plan.id, { name, startDate: startDate || null, activate }));
      onClose();
    } catch (err) {
      setError(`No se pudo duplicar (${err.message}).`);
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} labelledBy="dup-title" width="28rem">
      <form onSubmit={save}>
        <Header id="dup-title" title="Duplicar plan" onClose={onClose} />
        <div className="p-6 space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Copia las rutinas, sus ejercicios y la agenda para arrancar un bloque nuevo. Tu historial no se toca.
          </p>
          <label className="block">
            <span className={label} style={{ color: "var(--text-muted)" }}>
              Nombre
            </span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label} style={{ color: "var(--text-muted)" }}>
              Empieza
            </span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} /> Que pase a ser el plan activo
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
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
              Duplicar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Crear o editar una rutina (nombre y descripción); borrarla. */
export function RoutineFormModal({ planId, routine, onClose, onSaved, onDeleted }) {
  const editing = !!routine?.id;
  const [name, setName] = useState(routine?.name ?? "");
  const [description, setDescription] = useState(routine?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function run(fn, after) {
    setBusy(true);
    setError(null);
    try {
      after(await fn());
      onClose();
    } catch (err) {
      setError(err.message === "name_required" ? "Falta el nombre." : `No se pudo guardar (${err.message}).`);
      setBusy(false);
    }
  }
  const save = (e) => {
    e.preventDefault();
    const data = { name, description };
    run(() => (editing ? api.updateFisicoRoutine(routine.id, data) : api.addFisicoRoutine(planId, data)), onSaved);
  };
  return (
    <Modal onClose={onClose} labelledBy="routine-form-title" width="30rem">
      <form onSubmit={save}>
        <Header id="routine-form-title" title={editing ? "Editar rutina" : "Nueva rutina"} onClose={onClose} />
        <div className="p-6 space-y-4">
          <label className="block">
            <span className={label} style={{ color: "var(--text-muted)" }}>
              Nombre
            </span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Pull A" autoFocus />
          </label>
          <label className="block">
            <span className={label} style={{ color: "var(--text-muted)" }}>
              Descripción
            </span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={field} placeholder="Espalda y bíceps pesado. Antes: calistenia en la plaza." />
          </label>
          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            {editing &&
              (confirmDelete ? (
                <button type="button" onClick={() => run(() => api.deleteFisicoRoutine(routine.id), onDeleted)} className="h-10 px-3 rounded-lg text-sm font-semibold mr-auto" style={{ background: "var(--danger)", color: "#fff" }}>
                  Sí, borrar la rutina
                </button>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="hover-surface flex items-center gap-1.5 h-10 px-3 text-sm mr-auto" style={{ color: "var(--danger)" }}>
                  <Trash2 size={15} /> Borrar
                </button>
              ))}
            <button type="button" onClick={onClose} className="hover-surface h-10 px-4 text-sm ml-auto" style={{ border: "1px solid var(--border)" }}>
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              {editing ? "Guardar" : "Crear rutina"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
