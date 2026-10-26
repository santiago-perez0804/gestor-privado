import { CreditCard, Landmark } from "lucide-react";
import { FieldLabel } from "../common/FieldLabel.jsx";
import { PAYMENT_METHODS } from "../../lib/billing.js";

export function PaymentMethodToggle({ value, onChange }) {
  return (
    <div>
      <FieldLabel>Medio de pago</FieldLabel>
      {/* pm-toggle: en columnas angostas se esconden los íconos (container query en index.css). */}
      <div className="pm-toggle grid grid-cols-2 gap-1 rounded-lg p-1 h-10" style={{ background: "var(--surface-alt)" }}>
        {PAYMENT_METHODS.map((m) => {
          const active = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              aria-pressed={active}
              className="min-w-0 flex items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold"
              style={active ? { background: "var(--accent)", color: "#fff" } : { color: "var(--text-muted)" }}
            >
              {m.id === "credito" ? <CreditCard size={13} className="pm-icon shrink-0" /> : <Landmark size={13} className="pm-icon shrink-0" />}
              <span className="truncate">{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
