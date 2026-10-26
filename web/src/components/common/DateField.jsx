import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { todayDateInputValue } from "../../lib/format.js";

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const pad = (n) => String(n).padStart(2, "0");

/** "Hoy, 26/10" · "Ayer, 25/10" · "lun 20/10" · "20/10/25" (otro año). */
export function relativeDateLabel(dateStr, today = todayDateInputValue()) {
  if (!dateStr) return "Elegir fecha";
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date(today + "T00:00:00");
  const dm = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const days = Math.round((t - d) / 86_400_000);
  if (days === 0) return `Hoy, ${dm}`;
  if (days === 1) return `Ayer, ${dm}`;
  if (days === -1) return `Mañana, ${dm}`;
  if (d.getFullYear() !== t.getFullYear()) return `${dm}/${String(d.getFullYear()).slice(2)}`;
  return `${WEEKDAYS[d.getDay()]} ${dm}`;
}

/** Fecha legible con el calendario nativo del navegador (se abre con showPicker). */
export function DateField({ value, onChange, label = "Fecha" }) {
  const inputRef = useRef(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        aria-label={`${label}: ${relativeDateLabel(value)}. Cambiar`}
        className="w-full h-10 flex items-center justify-between gap-2 rounded-lg px-3 text-sm"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <span className="truncate">{relativeDateLabel(value)}</span>
        <CalendarDays size={15} className="shrink-0" style={{ color: "var(--text-faint)" }} />
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      />
    </div>
  );
}
