import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Check, CopyPlus, Plus, Power, Repeat } from "lucide-react";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { DeleteButton } from "../../components/common/DeleteButton.jsx";
import { EditButton } from "../../components/common/EditButton.jsx";
import { FieldLabel, inputClass } from "../../components/common/FieldLabel.jsx";
import { CurrencyAmountField } from "../../components/expenses/CurrencyAmountField.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { getBillingMonth, billingMonthAdd, billingMonthDiff, billingMonthKey, billingMonthLabel, billingPeriodRange } from "../../lib/billing.js";
import { currency, formatShortDate, todayDateInputValue } from "../../lib/format.js";
import { INCOME_CATEGORIES, incomeCategoryLabel, monthlyIncome } from "../../lib/finance.js";
import { addMonths } from "../../lib/installments.js";

function toPayload({ title, amountState, category, date, notes }) {
  const originalAmount = parseFloat(amountState.originalAmount);
  const isUsd = amountState.currency === "USD";
  const rate = isUsd ? parseFloat(amountState.exchangeRate) : null;
  if (!title.trim() || !originalAmount || (isUsd && !rate)) return null;
  return {
    title: title.trim(),
    amount: isUsd ? originalAmount * rate : originalAmount,
    currency: amountState.currency,
    originalAmount,
    exchangeRate: rate,
    category,
    date,
    notes: notes?.trim() || null,
  };
}

function IncomeForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [amountState, setAmountState] = useState({
    currency: initial?.currency ?? "ARS",
    originalAmount: initial?.originalAmount ?? "",
    exchangeRate: initial?.exchangeRate ?? null,
  });
  const [category, setCategory] = useState(initial?.category ?? "sueldo");
  const [date, setDate] = useState(initial?.date ?? todayDateInputValue());
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(e) {
    e.preventDefault();
    const payload = toPayload({ title, amountState, category, date, notes });
    if (!payload) return;
    onSubmit(payload);
    if (!initial) {
      setTitle("");
      setAmountState({ currency: "ARS", originalAmount: "", exchangeRate: null });
      setNotes("");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <div>
        <FieldLabel>Concepto</FieldLabel>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Sueldo octubre" className={inputClass()} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CurrencyAmountField value={amountState} onChange={setAmountState} defaultRateType="blue" side="compra" />
        <div>
          <FieldLabel>Fecha de cobro</FieldLabel>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass()} />
        </div>
      </div>
      <div>
        <FieldLabel>Tipo</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {INCOME_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: category === c.id ? "var(--accent)" : "var(--surface-alt)",
                color: category === c.id ? "#fff" : "var(--text-muted)",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" className={inputClass()} />
      <div className="flex gap-2">
        <button type="submit" className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
          {initial ? <Check size={16} /> : <Plus size={16} />}
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg px-4 text-sm font-medium" style={{ background: "var(--surface-alt)" }}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

const usdFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Ingresos fijos (sueldo, alquiler que cobrás…): se anotan solos el día indicado de cada período. */
function RecurringIncomesCard({ onGenerated }) {
  const listApi = useApi(api.getRecurringIncomes, []);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [category, setCategory] = useState("sueldo");
  const [day, setDay] = useState("1");

  async function add(e) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!title.trim() || !n) return;
    const created = await api.addRecurringIncome({ title: title.trim(), amount: n, currency: currencyCode, category, dayOfMonth: parseInt(day, 10) });
    listApi.setData((prev) => [created, ...(prev || [])]);
    setTitle("");
    setAmount("");
    onGenerated();
  }

  async function toggle(item) {
    const updated = await api.updateRecurringIncome(item.id, { active: !item.active });
    listApi.setData((prev) => prev.map((r) => (r.id === item.id ? updated : r)));
    if (updated.active) onGenerated();
  }

  async function remove(id) {
    await api.deleteRecurringIncome(id);
    listApi.setData((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <Card>
      <SectionHeading icon={Repeat}>Ingresos fijos</SectionHeading>
      <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>
        Se anotan solos cuando llega el día de cobro de cada período. Si el monto cambia (aumento, aguinaldo), editá el ingreso generado o cargá uno extra.
      </p>
      <form onSubmit={add} className="space-y-2 mb-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Sueldo" className={inputClass()} />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <FieldLabel>Monto</FieldLabel>
            <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputClass()} />
          </div>
          <div>
            <FieldLabel>Moneda</FieldLabel>
            <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className={inputClass()}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <FieldLabel>Día de cobro</FieldLabel>
            <input type="number" min="1" max="28" value={day} onChange={(e) => setDay(e.target.value)} className={inputClass()} />
          </div>
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass()}>
          {INCOME_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="submit" className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
          <Plus size={15} />
          Agregar ingreso fijo
        </button>
      </form>
      {(listApi.data || []).map((item) => (
        <div key={item.id} className="flex items-center gap-3 py-2" style={{ borderTop: "1px solid var(--border)", opacity: item.active ? 1 : 0.5 }}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{item.title}</p>
            <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              Día {item.dayOfMonth} · {incomeCategoryLabel(item.category)}
              {item.currency === "USD" && " · se valúa al blue compra"}
            </p>
          </div>
          <p className="font-mono text-sm tabular-nums">{(item.currency === "USD" ? usdFmt : currency).format(item.amount)}</p>
          <button onClick={() => toggle(item)} aria-label={item.active ? "Pausar" : "Activar"} className="rounded-md p-1.5" style={{ color: item.active ? "var(--accent-strong)" : "var(--text-faint)" }}>
            <Power size={15} />
          </button>
          <DeleteButton onClick={() => remove(item.id)} label="Borrar ingreso fijo" />
        </div>
      ))}
    </Card>
  );
}

function IncomeRow({ income, onEdit, onDelete }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-3 py-2.5"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 32, height: 32, background: "color-mix(in srgb, var(--chart-cat-1) 14%, transparent)", color: "var(--chart-cat-1)" }}>
        <Banknote size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{income.title}</p>
        <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
          {formatShortDate(income.date)} · {incomeCategoryLabel(income.category)}
          {income.currency === "USD" && ` · US$${income.originalAmount} @ ${income.exchangeRate}`}
        </p>
      </div>
      <p className="font-mono text-sm font-medium tabular-nums shrink-0" style={{ color: "var(--chart-cat-1)" }}>
        +{currency.format(income.amount)}
      </p>
      <EditButton onClick={onEdit} label="Editar" />
      <DeleteButton onClick={onDelete} label="Borrar" />
    </motion.div>
  );
}

export function Ingresos() {
  const incomesApi = useApi(api.getIncomes, []);
  const [editingId, setEditingId] = useState(null);
  const [copying, setCopying] = useState(false);

  if (!incomesApi.data) return null;
  const incomes = incomesApi.data;
  const currentBM = getBillingMonth(todayDateInputValue());
  const prevBM = billingMonthAdd(currentBM, -1);
  const currentTotal = monthlyIncome(incomes, currentBM);
  const prevItems = incomes.filter((i) => billingMonthDiff(getBillingMonth(i.date), prevBM) === 0);
  const currentItems = incomes.filter((i) => billingMonthDiff(getBillingMonth(i.date), currentBM) === 0);

  // Agrupado por período de tarjeta, el más reciente primero.
  const groups = {};
  for (const inc of incomes) {
    const bm = getBillingMonth(inc.date);
    const key = billingMonthKey(bm);
    (groups[key] ??= { bm, items: [] }).items.push(inc);
  }
  const ordered = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));

  async function handleAdd(data) {
    const created = await api.addIncome(data);
    incomesApi.setData((prev) => [created, ...prev]);
  }

  async function handleUpdate(id, data) {
    const updated = await api.updateIncome(id, data);
    incomesApi.setData((prev) => prev.map((i) => (i.id === id ? updated : i)));
    setEditingId(null);
  }

  async function handleDelete(id) {
    await api.deleteIncome(id);
    incomesApi.setData((prev) => prev.filter((i) => i.id !== id));
  }

  async function repeatPrevious() {
    setCopying(true);
    try {
      const created = [];
      for (const inc of prevItems) {
        created.push(
          await api.addIncome({
            title: inc.title,
            amount: inc.amount,
            currency: inc.currency,
            originalAmount: inc.originalAmount,
            exchangeRate: inc.exchangeRate,
            category: inc.category,
            date: addMonths(inc.date, 1),
            notes: inc.notes,
          })
        );
      }
      incomesApi.setData((prev) => [...created, ...prev]);
    } finally {
      setCopying(false);
    }
  }

  return (
    <PageTransition>
      <PageHeader title="Ingresos" subtitle="Se agrupan por período de tarjeta, igual que los gastos" />
      <div className="grid gap-4 items-start lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <p className="text-xs capitalize" style={{ color: "var(--text-faint)" }}>
            {billingMonthLabel(currentBM)} · {billingPeriodRange(currentBM)}
          </p>
          <p className="font-mono text-3xl font-semibold tabular-nums" style={{ color: "var(--chart-cat-1)" }}>
            {currency.format(currentTotal)}
          </p>
          {prevItems.length > 0 && currentItems.length === 0 && (
            <button
              onClick={repeatPrevious}
              disabled={copying}
              className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold"
              style={{ background: "var(--accent-soft)", color: "var(--accent-strong)", opacity: copying ? 0.6 : 1 }}
            >
              <CopyPlus size={14} />
              Repetir los {prevItems.length} ingresos del período anterior ({currency.format(prevItems.reduce((s, i) => s + i.amount, 0))})
            </button>
          )}
        </Card>

        <RecurringIncomesCard onGenerated={incomesApi.reload} />

        <Card>
          <SectionHeading icon={Plus}>Nuevo ingreso</SectionHeading>
          <IncomeForm onSubmit={handleAdd} submitLabel="Agregar ingreso" />
        </Card>

        <Card>
          <SectionHeading icon={Banknote}>Historial</SectionHeading>
          {ordered.length === 0 ? (
            <EmptyState icon={Banknote}>Todavía no cargaste ingresos.</EmptyState>
          ) : (
            ordered.map(([key, { bm, items }]) => (
              <div key={key} className="mb-3 last:mb-0">
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-xs font-semibold capitalize" style={{ color: "var(--text-muted)" }}>
                    {billingMonthLabel(bm)}
                  </p>
                  <p className="text-xs font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {currency.format(items.reduce((s, i) => s + i.amount, 0))}
                  </p>
                </div>
                <AnimatePresence initial={false}>
                  {items.map((inc) =>
                    editingId === inc.id ? (
                      <div key={inc.id} className="py-3" style={{ borderTop: "1px solid var(--border)" }}>
                        <IncomeForm initial={inc} onSubmit={(d) => handleUpdate(inc.id, d)} onCancel={() => setEditingId(null)} submitLabel="Guardar" />
                      </div>
                    ) : (
                      <IncomeRow key={inc.id} income={inc} onEdit={() => setEditingId(inc.id)} onDelete={() => handleDelete(inc.id)} />
                    )
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </Card>
      </div>
    </PageTransition>
  );
}
