import { useState } from "react";
import { X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { api } from "../../lib/api.js";
import { EASEL_INTERVALS, EASEL_ORDERS } from "../../lib/ocio/gallery.js";

function Chips({ label, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={on} className="h-9 px-3.5 rounded-full text-sm font-medium" style={{ border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent", color: on ? "var(--text)" : "var(--text-muted)" }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Configuración del atril: cada cuánto rota, en qué orden y si aparece en Inicio. Se guarda al tocar. */
export function EaselSettingsModal({ settings, onClose, onSaved }) {
  const [s, setS] = useState(settings);
  const [error, setError] = useState(null);
  async function change(patch) {
    const next = { ...s, ...patch };
    setS(next);
    try {
      onSaved(await api.setEaselSettings(next));
      setError(null);
    } catch (err) {
      setError(`No se pudo guardar (${err.message}).`);
    }
  }
  return (
    <Modal onClose={onClose} labelledBy="easel-settings-title" width="28rem">
      <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 id="easel-settings-title" className="text-base font-semibold mr-auto">
          El atril
        </h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
          <X size={18} />
        </button>
      </div>
      <div className="p-6 space-y-5">
        <Chips label="Cambiar de obra" options={EASEL_INTERVALS} value={s.interval} onChange={(interval) => change({ interval })} />
        <Chips label="Orden" options={EASEL_ORDERS} value={s.order} onChange={(order) => change({ order })} />
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={s.showOnHome} onChange={(e) => change({ showOnHome: e.target.checked })} />
          Mostrar el atril en Inicio
        </label>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          Rotan las obras marcadas «Mostrar en el atril». El modo museo usa esta misma configuración.
        </p>
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
