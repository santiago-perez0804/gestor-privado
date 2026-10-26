import { useEffect, useRef, useState } from "react";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { api } from "../../lib/api.js";

export const RATE_TYPES = [
  { id: "tarjeta", label: "Tarjeta", hint: "Oficial + 30% de percepción: lo que cobra el banco si pagás el resumen en pesos" },
  { id: "bolsa", label: "MEP", hint: "Si pagás el resumen con dólares comprados por MEP, sin percepción" },
  { id: "blue", label: "Blue", hint: "Dólar informal" },
  { id: "oficial", label: "Oficial", hint: "Dólar oficial del banco, sin impuestos" },
];

/**
 * Monto en ARS o USD. En USD busca la cotización del tipo elegido: para gastos conviene "tarjeta"
 * (lo que realmente te cobran), para ingresos "blue" a precio de compra (lo que te dan si vendés).
 */
export function CurrencyAmountField({ value, onChange, defaultRateType = "tarjeta", side = "venta", hero = false }) {
  const { currency, originalAmount, exchangeRate } = value;
  const [rateType, setRateType] = useState(defaultRateType);
  const [rateStatus, setRateStatus] = useState("idle"); // idle | loading | ok | stale | unavailable
  // Al editar un gasto viejo en USD se respeta la cotización con la que se cargó.
  const keepInitialRate = useRef(currency === "USD" && !!exchangeRate);

  useEffect(() => {
    if (currency !== "USD") return;
    if (keepInitialRate.current) {
      keepInitialRate.current = false;
      return;
    }
    let cancelled = false;
    setRateStatus("loading");
    api
      .getExchangeRate(rateType, side)
      .then((data) => {
        if (cancelled) return;
        onChange({ ...value, exchangeRate: data.rate });
        setRateStatus(data.stale ? "stale" : "ok");
      })
      .catch(() => {
        if (cancelled) return;
        setRateStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, rateType]);

  const amountArs = currency === "USD" && exchangeRate ? (originalAmount || 0) * exchangeRate : originalAmount;

  const currencyToggle = (
    <div className={`flex rounded-md overflow-hidden shrink-0 ${hero ? "p-0.5 gap-0.5" : ""}`} style={hero ? { background: "var(--surface-alt)" } : { border: "1px solid var(--border)" }}>
      {["ARS", "USD"].map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange({ ...value, currency: c, exchangeRate: c === "ARS" ? null : exchangeRate })}
          aria-pressed={currency === c}
          className={`text-[11px] font-semibold ${hero ? "rounded px-2 py-1" : "px-2 py-0.5"}`}
          style={{
            background: currency === c ? "var(--accent)" : "transparent",
            color: currency === c ? "var(--on-accent)" : "var(--text-muted)",
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {hero ? (
        <>
          <FieldLabel>Monto</FieldLabel>
          <div className="hero-field flex items-center gap-2 rounded-xl pl-3.5 pr-2 h-14">
            <span className="font-mono text-lg shrink-0" style={{ color: "var(--text-faint)" }}>
              {currency === "USD" ? "US$" : "$"}
            </span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={originalAmount}
              onChange={(e) => onChange({ ...value, originalAmount: e.target.value })}
              aria-label="Monto"
              className="flex-1 min-w-0 font-mono text-2xl font-semibold tabular-nums"
            />
            {currencyToggle}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <FieldLabel>Monto</FieldLabel>
            {currencyToggle}
          </div>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={originalAmount}
            onChange={(e) => onChange({ ...value, originalAmount: e.target.value })}
            className={inputClass()}
          />
        </>
      )}
      {currency === "USD" && (
        <div className="mt-1.5 space-y-1">
          <div className="flex flex-wrap gap-1">
            {RATE_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.hint}
                onClick={() => setRateType(t.id)}
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: rateType === t.id ? "var(--accent-soft)" : "var(--surface-alt)",
                  color: rateType === t.id ? "var(--accent-strong)" : "var(--text-muted)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {rateStatus === "loading" && (
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Buscando cotización del dólar...
            </p>
          )}
          {rateStatus === "stale" && (
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Sin conexión: uso la última cotización guardada.
            </p>
          )}
          {rateStatus === "unavailable" && (
            <p className="text-xs" style={{ color: "var(--danger)" }}>
              No se pudo obtener la cotización, ingresala manualmente.
            </p>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>
              Cotización
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={exchangeRate ?? ""}
              onChange={(e) => onChange({ ...value, exchangeRate: e.target.value })}
              className={inputClass()}
              style={{ flex: 1 }}
              placeholder="ARS por USD"
            />
          </div>
          {originalAmount && exchangeRate ? (
            <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              ≈ {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amountArs)}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
