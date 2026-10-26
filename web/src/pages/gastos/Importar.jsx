import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, FileUp, Table2 } from "lucide-react";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { FieldLabel, inputClass } from "../../components/common/FieldLabel.jsx";
import { PaymentMethodToggle } from "../../components/expenses/PaymentMethodToggle.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { EXPENSE_CATEGORIES } from "../../lib/expenseCategories.js";
import { currency, formatShortDate } from "../../lib/format.js";
import { parseCsv, guessMapping, rowsToExpenses, findDuplicate } from "../../lib/importCsv.js";

const FIELDS = [
  { id: "date", label: "Fecha" },
  { id: "title", label: "Descripción" },
  { id: "amount", label: "Monto en $" },
  { id: "usd", label: "Monto en US$" },
  { id: "installment", label: "Cuota" },
];

export function Importar() {
  const navigate = useNavigate();
  const ctx = useApi(() => Promise.all([api.getExpenses(), api.getExchangeRate("tarjeta").catch(() => null)]), []);
  const [rows, setRows] = useState(null);
  const [map, setMap] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("credito");
  const [overrides, setOverrides] = useState({}); // key → { skip, category }
  const [status, setStatus] = useState({ busy: false, error: null });

  function load(text) {
    const parsed = parseCsv(text);
    setRows(parsed);
    setMap(guessMapping(parsed));
    setOverrides({});
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    // Muchos bancos exportan en Windows-1252: si UTF-8 trae caracteres rotos, probamos latin1.
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf);
    load(text);
  }

  const [expenses = [], rateInfo = null] = ctx.data || [];
  const items = useMemo(() => {
    if (!rows || !map) return [];
    return rowsToExpenses(rows, map, { usdRate: rateInfo?.rate ?? null, paymentMethod }).map((it) => ({
      ...it,
      duplicate: findDuplicate(it, expenses),
    }));
  }, [rows, map, paymentMethod, expenses, rateInfo]);

  const selected = items.filter((it) => !(overrides[it.key]?.skip ?? !!it.duplicate));
  const total = selected.reduce((s, it) => s + it.amount / it.installments, 0);
  const cols = rows ? Math.max(...rows.map((r) => r.length)) : 0;
  const colName = (i) => (map.headerRow >= 0 ? rows[map.headerRow][i] : "") || `Columna ${i + 1}`;

  async function importSelected() {
    if (!selected.length) return;
    setStatus({ busy: true, error: null });
    try {
      await api.addExpensesBulk(
        selected.map(({ key, duplicate, statementDate, installmentNumber, ...it }) => ({ ...it, category: overrides[key]?.category ?? it.category }))
      );
      navigate("/gastos");
    } catch (err) {
      setStatus({ busy: false, error: err.message });
    }
  }

  return (
    <PageTransition>
      <PageHeader title="Importar movimientos" subtitle="Desde el CSV del resumen o del home banking" />
      <div className="grid gap-4 items-start lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <SectionHeading icon={FileUp}>Archivo</SectionHeading>
          <input type="file" accept=".csv,.txt,text/csv" onChange={onFile} className="text-sm w-full" />
          <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
            En la mayoría de los home banking: Tarjetas → Último resumen / Movimientos → Descargar (CSV o Excel; si es Excel, guardalo como CSV). También podés pegar el texto acá abajo.
          </p>
          <textarea
            placeholder="Fecha;Descripción;Importe…"
            rows={3}
            onBlur={(e) => e.target.value.trim() && load(e.target.value)}
            className={`${inputClass()} mt-2 font-mono text-xs`}
          />
        </Card>

        {rows && map && (
          <Card>
            <SectionHeading icon={Table2}>Columnas</SectionHeading>
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map((f) => (
                <div key={f.id}>
                  <FieldLabel>{f.label}</FieldLabel>
                  <select value={map[f.id]} onChange={(e) => setMap({ ...map, [f.id]: parseInt(e.target.value, 10) })} className={inputClass()}>
                    <option value={-1}>—</option>
                    {Array.from({ length: cols }, (_, i) => (
                      <option key={i} value={i}>
                        {colName(i)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div>
                <FieldLabel>Fila de encabezado</FieldLabel>
                <input type="number" min="-1" value={map.headerRow + 1} onChange={(e) => setMap({ ...map, headerRow: parseInt(e.target.value, 10) - 1 })} className={inputClass()} />
              </div>
            </div>
            <div className="mt-3">
              <PaymentMethodToggle value={paymentMethod} onChange={setPaymentMethod} />
            </div>
            {map.usd >= 0 && (
              <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
                Los consumos en US$ se pasan a pesos a dólar tarjeta ({rateInfo ? currency.format(rateInfo.rate) : "sin cotización: no se importan"}).
              </p>
            )}
          </Card>
        )}

        {rows && (
          <Card padded={false} className="lg:col-span-2">
            <div className="px-5 pt-5">
              <SectionHeading icon={Check}>
                {items.length} movimientos · {selected.length} a importar
              </SectionHeading>
              {items.length === 0 && (
                <p className="text-sm pb-5" style={{ color: "var(--text-muted)" }}>
                  No reconocí movimientos. Revisá el mapeo de columnas de arriba.
                </p>
              )}
            </div>
            {items.map((it) => {
              const skip = overrides[it.key]?.skip ?? !!it.duplicate;
              const category = overrides[it.key]?.category ?? it.category ?? "";
              return (
                <div key={it.key} className="flex items-start gap-2 px-5 py-2.5" style={{ borderTop: "1px solid var(--border)", opacity: skip ? 0.5 : 1 }}>
                  <input
                    type="checkbox"
                    checked={!skip}
                    onChange={(e) => setOverrides((o) => ({ ...o, [it.key]: { ...o[it.key], skip: !e.target.checked } }))}
                    className="mt-1"
                    aria-label={`Importar ${it.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{it.title}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {formatShortDate(it.statementDate)}
                      {it.installments > 1 && ` · cuota ${it.installmentNumber}/${it.installments} (compra del ${formatShortDate(it.date)})`}
                      {it.currency === "USD" && ` · US$${(it.originalAmount / it.installments).toFixed(2)}`}
                    </p>
                    {it.duplicate && (
                      <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--status-warning)" }}>
                        <AlertTriangle size={11} />
                        Parece que ya está cargado: {it.duplicate.title} ({formatShortDate(it.duplicate.date)})
                      </p>
                    )}
                    <select
                      value={category}
                      onChange={(e) => setOverrides((o) => ({ ...o, [it.key]: { ...o[it.key], category: e.target.value || null } }))}
                      className="mt-1 rounded px-1.5 py-0.5 text-[11px]"
                    >
                      <option value="">Sin categoría</option>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm tabular-nums">{currency.format(it.amount / it.installments)}</p>
                    {it.installments > 1 && (
                      <p className="text-[10px] font-mono" style={{ color: "var(--text-faint)" }}>
                        de {currency.format(it.amount)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {items.length > 0 && (
              <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
                {status.error && (
                  <p className="text-xs mb-2" style={{ color: "var(--danger)" }}>
                    No se pudo importar ({status.error}).
                  </p>
                )}
                <button
                  onClick={importSelected}
                  disabled={!selected.length || status.busy}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold"
                  style={{ background: "var(--accent)", color: "#fff", opacity: !selected.length || status.busy ? 0.6 : 1 }}
                >
                  <Check size={16} />
                  {status.busy ? "Importando…" : `Importar ${selected.length} ${selected.length === 1 ? "movimiento" : "movimientos"} (${currency.format(total)})`}
                </button>
                <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
                  Las cuotas se cargan como la compra original con todas sus cuotas, así la proyección queda bien. Los pagos y reintegros del resumen se ignoran.
                </p>
              </div>
            )}
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
