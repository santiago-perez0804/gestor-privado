import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Receipt, Search, X } from "lucide-react";
import { EmptyState } from "../../common/EmptyState.jsx";
import { DeleteButton } from "../../common/DeleteButton.jsx";
import { EditButton } from "../../common/EditButton.jsx";
import { FieldLabel, inputClass } from "../../common/FieldLabel.jsx";
import { DateField } from "../../common/DateField.jsx";
import { getIconComponent, pickExpenseIcon } from "../../../lib/icons.js";
import { currency, todayDateInputValue } from "../../../lib/format.js";
import { getBillingMonth, billingMonthDiff, MONTHS_ES_ABBR, paymentMethodLabel, installmentAmount } from "../../../lib/billing.js";
import { dueInstallmentRows } from "../../../lib/installments.js";
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, categoryLabel, categoryColorVar } from "../../../lib/expenseCategories.js";
import { MERCHANT_TYPES } from "../../../lib/merchants.js";
import { CurrencyAmountField } from "../CurrencyAmountField.jsx";
import { PaymentMethodToggle } from "../PaymentMethodToggle.jsx";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tint = (cssVar, pct) => `color-mix(in srgb, var(${cssVar}) ${pct}%, transparent)`;

/** Ícono de la fila: el elegido, si no el que sugiere el título y, si tampoco, el de la categoría. */
function rowIcon(exp) {
  if (exp.icon) return exp.icon;
  const byTitle = pickExpenseIcon(exp.title);
  return byTitle !== "Receipt" ? byTitle : CATEGORY_ICONS[exp.category] ?? "Receipt";
}

function dayLabel(dateStr, today) {
  const d = new Date(dateStr + "T00:00:00");
  const days = Math.round((new Date(today + "T00:00:00") - d) / 86_400_000);
  const base = `${d.getDate()} ${MONTHS_ES_ABBR[d.getMonth()]}`;
  return days === 0 ? `Hoy · ${base}` : days === 1 ? `Ayer · ${base}` : `${WEEKDAYS[d.getDay()]} ${base}`;
}

function EditRow({ expense, onSave, onCancel }) {
  const [title, setTitle] = useState(expense.title);
  const [description, setDescription] = useState(expense.description || "");
  const [amountState, setAmountState] = useState({ currency: expense.currency, originalAmount: expense.originalAmount, exchangeRate: expense.exchangeRate });
  const [installments, setInstallments] = useState(expense.installments);
  const [category, setCategory] = useState(expense.category || "");
  const [merchantType, setMerchantType] = useState(expense.merchantType || "");
  const [date, setDate] = useState(expense.date);
  const [paymentMethod, setPaymentMethod] = useState(expense.paymentMethod || null);
  const isDebit = paymentMethod === "debito";

  function submit(e) {
    e.preventDefault();
    const originalAmount = parseFloat(amountState.originalAmount);
    const isUsd = amountState.currency === "USD";
    const rate = isUsd ? parseFloat(amountState.exchangeRate) : null;
    if (!title.trim() || !originalAmount || (isUsd && !rate)) return;
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      amount: isUsd ? originalAmount * rate : originalAmount,
      currency: amountState.currency,
      originalAmount,
      exchangeRate: rate,
      installments: isDebit ? 1 : parseInt(installments, 10),
      category: category || null,
      merchantType: merchantType || null,
      date,
      paymentMethod,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 px-4 lg:px-7 py-4" style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--accent) 5%, transparent)" }}>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <FieldLabel>Título · dónde</FieldLabel>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Qué compraste</FieldLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass()} placeholder="Opcional" />
        </div>
      </div>
      <div className="grid gap-2.5 grid-cols-2">
        <CurrencyAmountField value={amountState} onChange={setAmountState} />
        <PaymentMethodToggle value={paymentMethod} onChange={setPaymentMethod} />
      </div>
      <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
        <div className="min-w-0">
          <FieldLabel>Categoría</FieldLabel>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass()}>
            <option value="">Sin categoría</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <FieldLabel>Comercio</FieldLabel>
          <select value={merchantType} onChange={(e) => setMerchantType(e.target.value)} className={inputClass()}>
            <option value="">Sin indicar</option>
            {MERCHANT_TYPES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <FieldLabel>Cuotas</FieldLabel>
          <select value={isDebit ? 1 : installments} onChange={(e) => setInstallments(e.target.value)} disabled={isDebit} className={inputClass()} style={isDebit ? { opacity: 0.5 } : undefined}>
            {[1, 3, 4, 6, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <FieldLabel>Fecha</FieldLabel>
          <DateField value={date} onChange={setDate} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Check size={13} />
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: "var(--surface-alt)", color: "var(--text)" }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function CategoryChip({ id }) {
  const colorVar = categoryColorVar(id);
  return (
    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0" style={{ color: `var(${colorVar})`, background: tint(colorVar, 14) }}>
      <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: `var(${colorVar})` }} />
      {categoryLabel(id)}
    </span>
  );
}

function MovementRow({ item, onEdit, onDelete }) {
  const { exp, occurrence } = item;
  const Icon = getIconComponent(rowIcon(exp));
  const colorVar = exp.category ? categoryColorVar(exp.category) : null;
  const n = exp.installments || 1;
  const k = occurrence ? occurrence.k : 1;
  const sub = [paymentMethodLabel(exp.paymentMethod), n > 1 && `de ${currency.format(exp.amount)}`, exp.currency === "USD" && `US$${exp.originalAmount}`].filter(Boolean).join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className="movement-row flex items-center gap-3 px-4 lg:px-7 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span
        className="flex items-center justify-center rounded-lg shrink-0"
        style={{ width: 36, height: 36, color: colorVar ? `var(${colorVar})` : "var(--text-muted)", background: colorVar ? tint(colorVar, 14) : "var(--surface-alt)" }}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold truncate">{exp.title}</p>
          {exp.category && <CategoryChip id={exp.category} />}
          {n > 1 && (
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap" style={{ color: "var(--text-muted)", background: "var(--surface-alt)" }}>
              {k === n ? "Última cuota" : "Cuota"} {k}/{n}
            </span>
          )}
        </div>
        <p className="text-xs truncate mt-0.5" style={{ color: exp.description ? "var(--text-muted)" : "var(--text-faint)" }}>
          {exp.description || "Sin descripción"}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-sm font-semibold tabular-nums whitespace-nowrap">{currency.format(item.amount)}</p>
        {sub && (
          <p className="text-[11px] whitespace-nowrap" style={{ color: "var(--text-faint)" }}>
            {sub}
          </p>
        )}
      </div>
      <div className="row-actions flex items-center shrink-0">
        <EditButton onClick={onEdit} label={occurrence ? `Editar la compra ${exp.title}` : `Editar ${exp.title}`} />
        {onDelete ? <DeleteButton onClick={onDelete} label={`Borrar ${exp.title}`} /> : <span style={{ width: 27 }} aria-hidden="true" />}
      </div>
    </motion.div>
  );
}

const EMPTY_FILTERS = { q: "", category: "", method: "" };

/**
 * Movimientos de un período, agrupados por día. Incluye las cuotas 2..n que vencen en el período
 * (calculadas, no guardadas). Filtros: texto, categoría y medio de pago.
 */
export function MovementsList({ expenses, bm, onUpdate, onDelete }) {
  const [editingKey, setEditingKey] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const today = todayDateInputValue();
  const filtering = Object.values(filters).some(Boolean);

  // Todas las filas del período (compras + cuotas que vencen en él), las más nuevas primero.
  const periodItems = useMemo(() => {
    const inPeriod = (date) => billingMonthDiff(getBillingMonth(date), bm) === 0;
    const rows = [
      ...expenses.filter((e) => inPeriod(e.date)).map((exp) => ({ key: `e-${exp.id}`, date: exp.date, order: exp.id * 100, exp, occurrence: null, amount: (exp.installments || 1) > 1 ? installmentAmount(exp) : exp.amount })),
      ...dueInstallmentRows(expenses, today)
        .filter((occ) => inPeriod(occ.date))
        .map((occ) => ({ key: `i-${occ.key}`, date: occ.date, order: occ.expense.id * 100 + occ.k, exp: occ.expense, occurrence: occ, amount: occ.amount })),
    ];
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
  }, [expenses, bm, today]);

  const { groups, count, total } = useMemo(() => {
    const q = norm(filters.q);
    const shown = periodItems.filter(({ exp }) => {
      if (q && !norm(`${exp.title} ${exp.description || ""}`).includes(q)) return false;
      if (filters.category && (exp.category || "otros") !== filters.category) return false;
      if (filters.method && (exp.paymentMethod || "sin") !== filters.method) return false;
      return true;
    });
    const byDay = new Map();
    for (const item of shown) {
      if (!byDay.has(item.date)) byDay.set(item.date, { date: item.date, total: 0, items: [] });
      const g = byDay.get(item.date);
      g.items.push(item);
      g.total += item.amount;
    }
    return { groups: [...byDay.values()], count: shown.length, total: shown.reduce((s, i) => s + i.amount, 0) };
  }, [periodItems, filters]);

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const selectClass = "h-10 rounded-lg px-2.5 text-sm min-w-0";

  return (
    <section className="movements flex flex-col lg:flex-1 lg:min-h-0 max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)] max-lg:overflow-hidden" aria-labelledby="movements-title">
      <div className="flex flex-wrap items-center gap-2 px-4 lg:px-7 pt-4 pb-3 lg:pt-5">
        <h2 id="movements-title" className="text-base font-semibold mr-auto">
          Movimientos
        </h2>
        <div className="relative flex-1 basis-full sm:basis-auto sm:max-w-xs min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} />
          <input value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="Buscar gasto…" aria-label="Buscar gasto" className="w-full h-10 rounded-lg pl-9 pr-3 text-sm" />
        </div>
        <select value={filters.category} onChange={(e) => setFilter("category", e.target.value)} className={`${selectClass} flex-1 sm:flex-none`} aria-label="Filtrar por categoría">
          <option value="">Categoría</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={filters.method} onChange={(e) => setFilter("method", e.target.value)} className={`${selectClass} flex-1 sm:flex-none`} aria-label="Filtrar por medio de pago">
          <option value="">Medio</option>
          <option value="credito">Crédito</option>
          <option value="debito">Débito</option>
          <option value="sin">Sin indicar</option>
        </select>
        {filtering && (
          <div className="basis-full flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
            <span>
              {count} {count === 1 ? "movimiento" : "movimientos"} · <span className="font-mono">{currency.format(total)}</span>
            </span>
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="ghost-action flex items-center gap-0.5 font-semibold px-2 py-1 -my-1 -mr-2" style={{ color: "var(--accent-strong)" }}>
              <X size={12} />
              Limpiar
            </button>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="px-4 lg:px-7 pb-6">
          <EmptyState icon={Receipt}>{filtering ? "Ningún movimiento coincide con el filtro." : "No hay movimientos en este período."}</EmptyState>
        </div>
      ) : (
        <div className="thin-scroll lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          {groups.map((g) => (
            <div key={g.date}>
              {/* El encabezado del día queda fijo arriba mientras se scrollea (solo escritorio: en celular choca con las pestañas). */}
              <div
                className="lg:sticky lg:top-0 z-[1] flex items-center justify-between px-4 lg:px-7 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider"
                style={{ background: "var(--list-bg)", color: "var(--text-faint)", borderBottom: "1px solid var(--border)" }}
              >
                <span>{dayLabel(g.date, today)}</span>
                <span className="font-mono normal-case tracking-normal">{currency.format(g.total)}</span>
              </div>
              <AnimatePresence initial={false}>
                {g.items.map((item) =>
                  editingKey === item.key ? (
                    <EditRow
                      key={item.key}
                      expense={item.exp}
                      onSave={(data) => {
                        onUpdate(item.exp.id, data);
                        setEditingKey(null);
                      }}
                      onCancel={() => setEditingKey(null)}
                    />
                  ) : (
                    <MovementRow key={item.key} item={item} onEdit={() => setEditingKey(item.key)} onDelete={item.occurrence ? null : () => onDelete(item.exp.id)} />
                  )
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
