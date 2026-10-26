import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Check, Receipt, Scale } from "lucide-react";
import { api } from "../../lib/api.js";
import { EXPENSE_CATEGORIES } from "../../lib/expenseCategories.js";
import { currency as ars, todayDateInputValue, toLocalDateTimeInputValue } from "../../lib/format.js";
import { PAYMENT_METHODS } from "../../lib/billing.js";
import { INCOME_CATEGORIES } from "../../lib/finance.js";
import { parseExpenseText, parseWeightText } from "../quickParse.js";
import { guessMerchantType } from "../../lib/merchants.js";
import { ViewHeader, Segmented, PrimaryButton, Chip, inputStyle } from "./ui.jsx";

const usd = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function ExpenseForm({ onDone }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState(null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("credito");
  const [rate, setRate] = useState(null);
  const [status, setStatus] = useState({ busy: false, error: null });
  const inputRef = useRef(null);

  const parsed = useMemo(() => parseExpenseText(text), [text]);
  const effectiveCategory = categoryTouched ? category : parsed.category;

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    if (parsed.currency !== "USD" || rate) return;
    // Con tarjeta los consumos en USD se cobran a dólar tarjeta (oficial + 30%) si pagás en pesos.
    api
      .getExchangeRate("tarjeta")
      .then((d) => setRate(d.rate))
      .catch(() => setStatus((s) => ({ ...s, error: "No pude obtener la cotización del dólar." })));
  }, [parsed.currency, rate]);

  const isUsd = parsed.currency === "USD";
  const ready = parsed.amount > 0 && parsed.title && (!isUsd || rate);

  async function submit(e) {
    e.preventDefault();
    if (!ready || status.busy) return;
    setStatus({ busy: true, error: null });
    const amount = isUsd ? parsed.amount * rate : parsed.amount;
    try {
      await api.addExpense({
        title: parsed.title,
        description: null,
        amount,
        currency: parsed.currency,
        originalAmount: parsed.amount,
        exchangeRate: isUsd ? rate : null,
        installments: 1,
        date: todayDateInputValue(),
        icon: null,
        category: effectiveCategory || null,
        merchantType: guessMerchantType(parsed.title, null, isUsd ? null : parsed.amount),
        paymentMethod,
      });
      onDone({ kind: "expense", text: `${ars.format(amount)} en ${parsed.title}` });
    } catch (err) {
      setStatus({ busy: false, error: `No se pudo guardar (${err.message}).` });
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ej: 1500 súper · u$s 10 spotify"
        spellCheck={false}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={inputStyle}
      />
      <div className="rounded-xl px-3 py-2 text-xs flex items-center gap-2 min-h-[36px]" style={{ background: "var(--surface-alt)" }}>
        {parsed.amount ? (
          <>
            <span className="font-mono font-semibold" style={{ color: "var(--accent-strong)" }}>
              {isUsd ? usd.format(parsed.amount) : ars.format(parsed.amount)}
            </span>
            {isUsd && rate && (
              <span className="font-mono" style={{ color: "var(--text-faint)" }}>
                ≈ {ars.format(parsed.amount * rate)}
              </span>
            )}
            <span className="truncate flex-1" style={{ color: parsed.title ? "var(--text)" : "var(--text-faint)" }}>
              {parsed.title || "falta el concepto"}
            </span>
          </>
        ) : (
          <span style={{ color: "var(--text-faint)" }}>Escribí el monto y en qué lo gastaste.</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EXPENSE_CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            active={effectiveCategory === c.id}
            color={`var(${c.colorVar})`}
            onClick={() => {
              setCategoryTouched(true);
              setCategory(effectiveCategory === c.id ? null : c.id);
            }}
          >
            {c.label}
          </Chip>
        ))}
      </div>
      <Segmented options={PAYMENT_METHODS.map((p) => ({ value: p.id, label: p.label }))} value={paymentMethod} onChange={setPaymentMethod} />
      {status.error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {status.error}
        </p>
      )}
      <PrimaryButton type="submit" disabled={!ready || status.busy}>
        <Check size={15} />
        {status.busy ? "Guardando…" : "Anotar gasto"}
      </PrimaryButton>
    </form>
  );
}

function WeightForm({ onDone }) {
  const [text, setText] = useState("");
  const [last, setLast] = useState(null);
  const [status, setStatus] = useState({ busy: false, error: null });
  const inputRef = useRef(null);
  const weight = parseWeightText(text);

  useEffect(() => {
    inputRef.current?.focus();
    api
      .getWeights()
      .then((ws) => setLast([...ws].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0] ?? null))
      .catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!weight || status.busy) return;
    setStatus({ busy: true, error: null });
    try {
      await api.addWeight({ weight, recordedAt: toLocalDateTimeInputValue() });
      const delta = last ? +(weight - last.weight).toFixed(1) : null;
      onDone({ kind: "weight", text: `${weight} kg${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}` });
    } catch (err) {
      setStatus({ busy: false, error: `No se pudo guardar (${err.message}).` });
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <div className="relative">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputMode="decimal"
          placeholder={last ? String(last.weight) : "82.5"}
          className="w-full rounded-xl px-3 py-2.5 text-2xl font-mono font-semibold outline-none"
          style={inputStyle}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-faint)" }}>
          kg
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {last ? `Último registro: ${last.weight} kg` : "Todavía no hay registros de peso."}
      </p>
      {status.error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {status.error}
        </p>
      )}
      <PrimaryButton type="submit" disabled={!weight || status.busy}>
        <Check size={15} />
        {status.busy ? "Guardando…" : "Registrar peso"}
      </PrimaryButton>
    </form>
  );
}

function IncomeForm({ onDone }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("sueldo");
  const [status, setStatus] = useState({ busy: false, error: null });
  const inputRef = useRef(null);
  const parsed = useMemo(() => parseExpenseText(text), [text]);
  const [rate, setRate] = useState(null);
  const isUsd = parsed.currency === "USD";

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    if (!isUsd || rate) return;
    // Ingresos en USD: se valúan a lo que te darían si los vendés (blue compra).
    api
      .getExchangeRate("blue", "compra")
      .then((d) => setRate(d.rate))
      .catch(() => setStatus((s) => ({ ...s, error: "No pude obtener la cotización del dólar." })));
  }, [isUsd, rate]);

  const ready = parsed.amount > 0 && (!isUsd || rate);
  const amountArs = isUsd && rate ? parsed.amount * rate : parsed.amount;

  async function submit(e) {
    e.preventDefault();
    if (!ready || status.busy) return;
    setStatus({ busy: true, error: null });
    const title = parsed.title || INCOME_CATEGORIES.find((c) => c.id === category).label;
    try {
      await api.addIncome({
        title,
        amount: amountArs,
        currency: parsed.currency,
        originalAmount: parsed.amount,
        exchangeRate: isUsd ? rate : null,
        category,
        date: todayDateInputValue(),
      });
      onDone({ kind: "income", text: `ingreso de ${isUsd ? usd.format(parsed.amount) : ars.format(parsed.amount)} (${title})` });
    } catch (err) {
      setStatus({ busy: false, error: `No se pudo guardar (${err.message}).` });
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ej: 950000 sueldo octubre"
        spellCheck={false}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={inputStyle}
      />
      {isUsd && rate && parsed.amount > 0 && (
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {usd.format(parsed.amount)} ≈ {ars.format(amountArs)} (blue compra)
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {INCOME_CATEGORIES.map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>
      {status.error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {status.error}
        </p>
      )}
      <PrimaryButton type="submit" disabled={!ready || status.busy}>
        <Check size={15} />
        {status.busy ? "Guardando…" : `Anotar ingreso${parsed.amount ? ` de ${isUsd ? usd.format(parsed.amount) : ars.format(parsed.amount)}` : ""}`}
      </PrimaryButton>
    </form>
  );
}

export function QuickAddView({ ctl }) {
  const [kind, setKind] = useState("expense");
  return (
    <div>
      <ViewHeader title="Carga rápida" onBack={() => ctl.setView("home")} />
      <div className="flex flex-col gap-3">
        <Segmented
          options={[
            { value: "expense", label: "Gasto", icon: Receipt },
            { value: "income", label: "Ingreso", icon: Banknote },
            { value: "weight", label: "Peso", icon: Scale },
          ]}
          value={kind}
          onChange={setKind}
        />
        {kind === "expense" && <ExpenseForm key="e" onDone={ctl.onQuickAdded} />}
        {kind === "income" && <IncomeForm key="i" onDone={ctl.onQuickAdded} />}
        {kind === "weight" && <WeightForm key="w" onDone={ctl.onQuickAdded} />}
      </div>
    </div>
  );
}
