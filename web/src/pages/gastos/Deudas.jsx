import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, HandCoins, Plus, RotateCcw } from "lucide-react";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { DeleteButton } from "../../components/common/DeleteButton.jsx";
import { FieldLabel, inputClass } from "../../components/common/FieldLabel.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { EXPENSE_CATEGORIES } from "../../lib/expenseCategories.js";
import { currency, formatShortDate, todayDateInputValue } from "../../lib/format.js";

const usd = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmt = (debt, v) => (debt.currency === "USD" ? usd : currency).format(v);

const DIRECTIONS = [
  { id: "debo", label: "Debo" },
  { id: "me_deben", label: "Me deben" },
];

// createdAt/settledAt vienen en UTC: los pasamos a fecha local antes de formatear.
const isoDay = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function daysUntil(dateStr) {
  const today = new Date(todayDateInputValue() + "T00:00:00");
  return Math.round((new Date(dateStr + "T00:00:00") - today) / 86_400_000);
}

function dueLabel(dueDate) {
  const d = daysUntil(dueDate);
  if (d < 0) return { text: `Venció hace ${-d} día${d === -1 ? "" : "s"}`, color: "var(--danger)" };
  if (d === 0) return { text: "Vence hoy", color: "var(--status-warning)" };
  if (d <= 3) return { text: `Vence en ${d} día${d === 1 ? "" : "s"}`, color: "var(--status-warning)" };
  return { text: `Vence el ${formatShortDate(dueDate)}`, color: "var(--text-faint)" };
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--surface-alt)" }}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className="flex-1 rounded-md py-1.5 text-xs font-semibold"
            style={{ background: active ? "var(--accent)" : "transparent", color: active ? "#fff" : "var(--text-muted)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DebtForm({ onSubmit }) {
  const [direction, setDirection] = useState("debo");
  const [title, setTitle] = useState("");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [debtCurrency, setDebtCurrency] = useState("ARS");
  const [dueDate, setDueDate] = useState("");

  function submit(e) {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!title.trim() || !(value > 0)) return;
    onSubmit({ direction, title: title.trim(), person: person.trim() || null, amount: value, currency: debtCurrency, dueDate: dueDate || null });
    setTitle("");
    setPerson("");
    setAmount("");
    setDueDate("");
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <Segmented value={direction} onChange={setDirection} options={DIRECTIONS} />
      <div>
        <FieldLabel>Concepto</FieldLabel>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Juntada con amigos" className={inputClass()} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Monto</FieldLabel>
          <div className="flex gap-1">
            <select value={debtCurrency} onChange={(e) => setDebtCurrency(e.target.value)} className="rounded-lg px-2 text-sm">
              <option value="ARS">$</option>
              <option value="USD">US$</option>
            </select>
            <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5300" className={inputClass()} />
          </div>
        </div>
        <div>
          <FieldLabel>{direction === "debo" ? "¿A quién? (opcional)" : "¿Quién? (opcional)"}</FieldLabel>
          <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Ej. Juan" className={inputClass()} />
        </div>
      </div>
      <div>
        <FieldLabel>Fecha límite (opcional)</FieldLabel>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass()} />
      </div>
      <button type="submit" className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
        <Plus size={16} />
        Agregar deuda
      </button>
    </form>
  );
}

function DebtRow({ debt, onPay, onDelete }) {
  const [open, setOpen] = useState(false);
  const [partial, setPartial] = useState("");
  // Al saldar una deuda propia en pesos se puede cargar como gasto en el mismo paso.
  const canLogExpense = debt.direction === "debo" && debt.currency === "ARS";
  const [logExpense, setLogExpense] = useState(canLogExpense);
  const [category, setCategory] = useState("ocio");
  const remaining = Math.max(0, debt.amount - debt.paidAmount);
  const ratio = debt.amount ? debt.paidAmount / debt.amount : 0;
  const due = debt.dueDate ? dueLabel(debt.dueDate) : null;
  const color = debt.direction === "debo" ? "var(--danger)" : "var(--status-good)";

  async function pay(amount) {
    if (!(amount > 0)) return;
    await onPay(debt, Math.min(amount, remaining), canLogExpense && logExpense ? category : null);
    setPartial("");
    setOpen(false);
  }

  return (
    <div className="py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold truncate">{debt.title}</p>
          <p className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
            {[debt.person, due ? null : `Desde ${formatShortDate(isoDay(debt.createdAt))}`].filter(Boolean).join(" · ")}
            {due && (
              <span style={{ color: due.color }}>
                {debt.person ? " · " : ""}
                {due.text}
              </span>
            )}
          </p>
        </button>
        <div className="text-right shrink-0">
          <p className="font-mono text-sm font-semibold tabular-nums" style={{ color }}>
            {fmt(debt, remaining)}
          </p>
          {debt.paidAmount > 0 && (
            <p className="font-mono text-[10px] tabular-nums" style={{ color: "var(--text-faint)" }}>
              de {fmt(debt, debt.amount)}
            </p>
          )}
        </div>
        <button
          onClick={() => pay(remaining)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold shrink-0"
          style={{ background: "var(--accent)", color: "#fff" }}
          title={debt.direction === "debo" ? (canLogExpense && logExpense ? "Marcar como pagada y cargarla como gasto" : "Marcar como pagada") : "Marcar como cobrada"}
        >
          <Check size={13} />
          {debt.direction === "debo" ? "Pagué" : "Cobré"}
        </button>
        <button onClick={() => setOpen((v) => !v)} aria-label="Más opciones" className="p-1 shrink-0" style={{ color: "var(--text-faint)" }}>
          <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : undefined }} />
        </button>
      </div>

      {debt.paidAmount > 0 && (
        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color }} />
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex gap-1.5 mt-2.5">
              <input
                type="number"
                min="0"
                step="any"
                value={partial}
                onChange={(e) => setPartial(e.target.value)}
                placeholder="Pago parcial"
                className={inputClass()}
                onKeyDown={(e) => e.key === "Enter" && pay(parseFloat(partial))}
              />
              <button
                onClick={() => pay(parseFloat(partial))}
                className="rounded-lg px-3 text-xs font-semibold shrink-0"
                style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}
              >
                Registrar
              </button>
              <DeleteButton onClick={() => onDelete(debt.id)} label="Borrar deuda" />
            </div>
            {canLogExpense && (
              <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={logExpense} onChange={(e) => setLogExpense(e.target.checked)} />
                  Cargar el pago como gasto
                </label>
                {logExpense && (
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg px-2 py-1 text-xs">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function totalsLabel(debts) {
  const ars = debts.filter((d) => d.currency === "ARS").reduce((s, d) => s + d.amount - d.paidAmount, 0);
  const u = debts.filter((d) => d.currency === "USD").reduce((s, d) => s + d.amount - d.paidAmount, 0);
  return [ars > 0 || !u ? currency.format(ars) : null, u > 0 ? usd.format(u) : null].filter(Boolean).join(" + ");
}

export function Deudas() {
  const debtsApi = useApi(api.getDebts, []);
  const [showSettled, setShowSettled] = useState(false);
  if (!debtsApi.data) return null;
  const debts = debtsApi.data;
  const pending = debts.filter((d) => !d.settledAt);
  const owe = pending.filter((d) => d.direction === "debo");
  const owed = pending.filter((d) => d.direction === "me_deben");
  const settled = debts.filter((d) => d.settledAt);

  const replace = (updated) => debtsApi.setData((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));

  async function handleAdd(data) {
    const created = await api.addDebt(data);
    debtsApi.setData((prev) => [created, ...prev]);
  }
  async function handlePay(debt, amount, expenseCategory) {
    replace(await api.payDebt(debt.id, amount));
    if (expenseCategory) {
      await api.addExpense({
        title: debt.person ? `${debt.title} (${debt.person})` : debt.title,
        description: null,
        amount,
        currency: "ARS",
        originalAmount: amount,
        exchangeRate: null,
        installments: 1,
        date: todayDateInputValue(),
        icon: null,
        category: expenseCategory,
        paymentMethod: "debito",
      });
    }
  }
  async function handleReopen(debt) {
    replace(await api.updateDebt(debt.id, { paidAmount: 0 }));
  }
  async function handleDelete(id) {
    await api.deleteDebt(id);
    debtsApi.setData((prev) => prev.filter((d) => d.id !== id));
  }

  const subtitle = pending.length
    ? [owe.length ? `Debés ${totalsLabel(owe)}` : null, owed.length ? `Te deben ${totalsLabel(owed)}` : null].filter(Boolean).join(" · ")
    : "Lo que tenés que pagar o cobrar";

  return (
    <PageTransition>
      <PageHeader title="Deudas pendientes" subtitle={subtitle} />
      <div className="grid gap-4 items-start lg:grid-cols-2 [&>*]:min-w-0">
        {pending.length === 0 && (
          <Card>
            <EmptyState icon={HandCoins}>No tenés deudas pendientes. Anotá acá lo que debés (o te deben) para no olvidarte.</EmptyState>
          </Card>
        )}
        {owe.length > 0 && (
          <Card>
            <SectionHeading icon={HandCoins} action={<span className="font-mono text-xs" style={{ color: "var(--danger)" }}>{totalsLabel(owe)}</span>}>
              Debo
            </SectionHeading>
            {owe.map((d) => (
              <DebtRow key={d.id} debt={d} onPay={handlePay} onDelete={handleDelete} />
            ))}
          </Card>
        )}
        {owed.length > 0 && (
          <Card>
            <SectionHeading icon={HandCoins} action={<span className="font-mono text-xs" style={{ color: "var(--status-good)" }}>{totalsLabel(owed)}</span>}>
              Me deben
            </SectionHeading>
            {owed.map((d) => (
              <DebtRow key={d.id} debt={d} onPay={handlePay} onDelete={handleDelete} />
            ))}
          </Card>
        )}
        <Card>
          <SectionHeading icon={Plus}>Nueva deuda</SectionHeading>
          <DebtForm onSubmit={handleAdd} />
        </Card>
        {settled.length > 0 && (
          <Card>
            <button onClick={() => setShowSettled((v) => !v)} className="w-full">
              <SectionHeading icon={Check} action={<ChevronDown size={14} style={{ color: "var(--text-faint)", transform: showSettled ? "rotate(180deg)" : undefined }} />}>
                Saldadas ({settled.length})
              </SectionHeading>
            </button>
            {showSettled &&
              settled.map((d) => (
                <div key={d.id} className="flex items-center gap-2 py-1.5 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text-muted)" }}>
                    {d.title}
                    {d.person ? ` · ${d.person}` : ""}
                  </span>
                  <span className="font-mono text-xs" style={{ color: "var(--text-faint)" }}>
                    {fmt(d, d.amount)} · {formatShortDate(isoDay(d.settledAt))}
                  </span>
                  <button onClick={() => handleReopen(d)} aria-label="Volver a pendiente" title="Volver a pendiente" className="p-1.5" style={{ color: "var(--text-faint)" }}>
                    <RotateCcw size={13} />
                  </button>
                  <DeleteButton onClick={() => handleDelete(d.id)} label="Borrar deuda" />
                </div>
              ))}
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
