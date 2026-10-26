import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { DateField } from "../common/DateField.jsx";
import { api } from "../../lib/api.js";
import { todayDateInputValue } from "../../lib/format.js";
import { OUTING_CATEGORIES, OUTING_STATUS } from "../../lib/ocio/outings.js";

const field = "w-full h-10 rounded-lg px-3 text-sm min-w-0";
const lbl = "block text-xs mb-1.5";

/** Crear o editar una salida. `initial` puede traer datos parciales (p. ej. de la carga rápida). */
export function OutingFormModal({ initial = {}, onClose, onSaved }) {
  const editing = !!initial.id;
  const [form, setForm] = useState({
    title: initial.title ?? "",
    date: initial.date ?? todayDateInputValue(),
    allDay: initial.startTime ? false : initial.allDay !== 0,
    startTime: initial.startTime ?? "",
    endTime: initial.endTime ?? "",
    place: initial.place ?? "",
    withWhom: initial.withWhom ?? "",
    category: initial.category ?? "",
    status: initial.status ?? "confirmed",
    notes: initial.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  async function save(e) {
    e.preventDefault();
    if (!form.title.trim()) return setError("Falta el título.");
    setBusy(true);
    setError(null);
    const data = {
      title: form.title,
      date: form.date,
      startTime: form.allDay ? null : form.startTime || null,
      endTime: form.allDay ? null : form.endTime || null,
      allDay: form.allDay || !form.startTime ? 1 : 0,
      place: form.place || null,
      withWhom: form.withWhom || null,
      category: form.category || null,
      status: form.status,
      notes: form.notes || null,
    };
    try {
      const saved = editing ? await api.updateOuting(initial.id, data) : await api.addOuting(data);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(`No se pudo guardar (${err.message}).`);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="outing-form-title" width="32rem">
      <form onSubmit={save}>
        <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 id="outing-form-title" className="text-base font-semibold mr-auto">
            {editing ? "Editar salida" : "Nueva salida"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-3.5">
          <label className="block">
            <span className={lbl} style={{ color: "var(--text-muted)" }}>
              Qué
            </span>
            <input value={form.title} onChange={set("title")} placeholder="Ej. La Fábrica · Halloween" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className={lbl} style={{ color: "var(--text-muted)" }}>
                Cuándo
              </span>
              <DateField value={form.date} onChange={set("date")} />
            </div>
            <div>
              <span className={lbl} style={{ color: "var(--text-muted)" }}>
                Horario
              </span>
              {form.allDay ? (
                <button type="button" onClick={() => setForm((f) => ({ ...f, allDay: false }))} className="hover-surface w-full h-10 text-sm text-left px-3" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  Sin horario · agregar
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input type="time" value={form.startTime} onChange={set("startTime")} className={field} aria-label="Desde" />
                  <input type="time" value={form.endTime} onChange={set("endTime")} className={field} aria-label="Hasta" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, allDay: true, startTime: "", endTime: "" }))} aria-label="Quitar horario" className="hover-surface w-8 h-8 shrink-0 flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className={lbl} style={{ color: "var(--text-muted)" }}>
                Dónde
              </span>
              <input value={form.place} onChange={set("place")} placeholder="Lugar" className={field} />
            </label>
            <label className="block">
              <span className={lbl} style={{ color: "var(--text-muted)" }}>
                Con quién
              </span>
              <input value={form.withWhom} onChange={set("withWhom")} placeholder="Opcional" className={field} />
            </label>
          </div>
          <div>
            <span className={lbl} style={{ color: "var(--text-muted)" }}>
              Categoría
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(OUTING_CATEGORIES).map(([id, c]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: f.category === id ? "" : id }))}
                  aria-pressed={form.category === id}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs"
                  style={{ border: `1px solid ${form.category === id ? c.color : "var(--border)"}`, background: form.category === id ? `color-mix(in srgb, ${c.color} 14%, transparent)` : "transparent", color: form.category === id ? "var(--text)" : "var(--text-muted)" }}
                >
                  <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: c.color }} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={lbl} style={{ color: "var(--text-muted)" }}>
              Estado
            </span>
            <div className="grid grid-cols-4 rounded-xl p-1 gap-1" style={{ background: "var(--surface-alt)" }}>
              {Object.entries(OUTING_STATUS).map(([id, s]) => (
                <button key={id} type="button" onClick={() => setForm((f) => ({ ...f, status: id }))} aria-pressed={form.status === id} className="h-8 rounded-lg text-xs truncate" style={{ background: form.status === id ? "var(--surface)" : "transparent", fontWeight: form.status === id ? 600 : 500, color: form.status === id ? "var(--text)" : "var(--text-muted)" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={lbl} style={{ color: "var(--text-muted)" }}>
              Notas
            </span>
            <textarea value={form.notes} onChange={set("notes")} rows={2} className="w-full rounded-lg px-3 py-2 text-sm resize-y" />
          </label>
          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="hover-surface h-10 px-4 text-sm" style={{ border: "1px solid var(--border)" }}>
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              {editing ? "Guardar" : "Crear salida"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
