import { useMemo, useState } from "react";
import { Lightbulb, Plus, Split, X } from "lucide-react";
import { IconPicker } from "../common/IconPicker.jsx";
import { InfoTip } from "../common/InfoTip.jsx";
import { DateField } from "../common/DateField.jsx";
import { EXPENSE_ICONS, pickExpenseIcon } from "../../lib/icons.js";
import { EXPENSE_CATEGORIES, categoryLabel } from "../../lib/expenseCategories.js";
import { MERCHANT_TYPES, learnFromHistory, suggestFor } from "../../lib/merchants.js";
import { FIELD_TIPS, classificationHint } from "../../lib/classificationGuide.js";
import { currency, todayDateInputValue } from "../../lib/format.js";
import { CurrencyAmountField } from "./CurrencyAmountField.jsx";
import { PaymentMethodToggle } from "./PaymentMethodToggle.jsx";

const INSTALLMENT_OPTIONS = [1, 3, 4, 6, 12];
const field = "w-full h-10 rounded-lg px-3 text-sm min-w-0";

/** Etiqueta de campo con ⓘ opcional y la marca "sugerido" si el valor se completó solo. */
function Label({ children, tip, suggested, hint }) {
  return (
    <span className="flex items-center gap-1 text-xs mb-1.5 min-w-0" style={{ color: "var(--text-muted)" }}>
      <span className="truncate">{children}</span>
      {hint && <span style={{ color: "var(--text-faint)" }}>{hint}</span>}
      {tip && <InfoTip tip={tip} />}
      {suggested && (
        <span className="ml-auto text-[10px] font-semibold rounded-full px-1.5 shrink-0" style={{ color: "var(--accent-strong)", background: "var(--accent-soft)" }} title="Completado según el título y lo que ya cargaste">
          sugerido
        </span>
      )}
    </span>
  );
}

const newSplit = (category) => ({ amount: "", category: category === "hogar" ? "comida" : "hogar", description: "" });

/** Panel plano en escritorio (va dentro de la columna izquierda del Resumen) y card en celular. */
export function QuickExpenseForm({ onAdd, expenses = [] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(null);
  const [amountState, setAmountState] = useState({ currency: "ARS", originalAmount: "", exchangeRate: null });
  const [installments, setInstallments] = useState("1");
  // null = sin tocar: se usa la sugerencia. "" = elegiste "Sin categoría" a propósito.
  const [category, setCategory] = useState(null);
  const [merchantType, setMerchantType] = useState(null);
  const [date, setDate] = useState(todayDateInputValue());
  const [paymentMethod, setPaymentMethod] = useState("credito");
  // Ticket dividido: una parte va a otra categoría (p. ej. la limpieza del súper a Hogar).
  const [split, setSplit] = useState(null);
  const isDebit = paymentMethod === "debito";

  const memory = useMemo(() => learnFromHistory(expenses), [expenses]);
  const total = parseFloat(amountState.originalAmount) || 0;
  const suggestion = suggestFor(title, description, memory, amountState.currency === "ARS" ? total : null);
  const effectiveCategory = category ?? suggestion.category ?? "";
  const effectiveMerchant = merchantType ?? suggestion.merchantType ?? "";
  const hint = classificationHint({ title, description, category: effectiveCategory, merchantType: effectiveMerchant });
  const splitAmount = split ? parseFloat(split.amount) || 0 : 0;
  const splitValid = split && splitAmount > 0 && splitAmount < total;

  function reset() {
    setTitle("");
    setDescription("");
    setIcon(null);
    setAmountState({ currency: "ARS", originalAmount: "", exchangeRate: null });
    setInstallments("1");
    setCategory(null);
    setMerchantType(null);
    setDate(todayDateInputValue());
    setSplit(null);
  }

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !total) return;
    const isUsd = amountState.currency === "USD";
    const rate = isUsd ? parseFloat(amountState.exchangeRate) : null;
    if (isUsd && !rate) return;
    if (split && !splitValid) return;

    const common = {
      title: title.trim(),
      currency: amountState.currency,
      exchangeRate: rate,
      installments: isDebit ? 1 : parseInt(installments, 10),
      date,
      icon,
      paymentMethod,
      merchantType: effectiveMerchant || null,
    };
    const parts = splitValid
      ? [
          { originalAmount: total - splitAmount, category: effectiveCategory, description },
          { originalAmount: splitAmount, category: split.category, description: split.description.trim() || description },
        ]
      : [{ originalAmount: total, category: effectiveCategory, description }];
    const payloads = parts.map((p) => ({
      ...common,
      originalAmount: p.originalAmount,
      amount: isUsd ? p.originalAmount * rate : p.originalAmount,
      category: p.category || null,
      description: p.description.trim() || null,
    }));

    reset();
    for (const payload of payloads) await onAdd(payload);
  }

  return (
    <section className="max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)] p-5 lg:px-6 lg:py-5" aria-labelledby="quick-expense-title">
      <h2 id="quick-expense-title" className="flex items-center gap-2 text-base font-semibold mb-4">
        <Plus size={18} style={{ color: "var(--accent)" }} />
        Gasto rápido
      </h2>
      <form onSubmit={submit} className="space-y-3.5">
        <CurrencyAmountField hero value={amountState} onChange={setAmountState} />

        <div>
          <Label tip={FIELD_TIPS.title}>Título · dónde</Label>
          <div className="relative">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Carrefour, kiosco de la esquina" className={`${field} pr-10`} />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <IconPicker compact value={icon} autoIconName={pickExpenseIcon(title)} options={EXPENSE_ICONS} onChange={setIcon} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <PaymentMethodToggle value={paymentMethod} onChange={setPaymentMethod} />
          <div className="min-w-0">
            <Label>Cuotas</Label>
            <select
              value={isDebit ? "1" : installments}
              onChange={(e) => setInstallments(e.target.value)}
              disabled={isDebit}
              title={isDebit ? "Las cuotas solo aplican a crédito" : undefined}
              className={field}
              style={isDebit ? { opacity: 0.5 } : undefined}
            >
              {INSTALLMENT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "cuota" : "cuotas"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-w-0">
            <Label tip={FIELD_TIPS.category} suggested={category === null && !!suggestion.category}>
              Categoría
            </Label>
            <select value={effectiveCategory} onChange={(e) => setCategory(e.target.value)} className={field}>
              <option value="">Sin categoría</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <Label tip={FIELD_TIPS.merchant} suggested={merchantType === null && !!suggestion.merchantType}>
              Comercio
            </Label>
            <select value={effectiveMerchant} onChange={(e) => setMerchantType(e.target.value)} className={field}>
              <option value="">Sin indicar</option>
              {MERCHANT_TYPES.map((m) => (
                <option key={m.id} value={m.id} title={m.hint}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-w-0">
            <Label tip={FIELD_TIPS.description} hint="(opcional)">
              Qué compraste
            </Label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. coca, alfajor" className={field} />
          </div>
          <div className="min-w-0">
            <Label>Fecha</Label>
            <DateField value={date} onChange={setDate} />
          </div>
        </div>

        {hint && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] leading-snug" style={{ background: "color-mix(in srgb, var(--status-warning) 9%, transparent)", color: "var(--text-muted)" }}>
            <Lightbulb size={13} className="shrink-0 mt-px" style={{ color: "var(--status-warning)" }} />
            <span className="flex-1">{hint.text}</span>
            {hint.action === "split" && !split && (
              <button type="button" onClick={() => setSplit(newSplit(effectiveCategory))} className="ghost-action font-semibold shrink-0 px-2 py-1 -my-1 -mr-1.5" style={{ color: "var(--accent-strong)" }}>
                Dividir
              </button>
            )}
          </div>
        )}

        {split && (
          <div className="rounded-xl p-3 space-y-2" style={{ border: "1px dashed var(--border)" }}>
            <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1.5">
                <Split size={13} />
                Parte en otra categoría
              </span>
              <button type="button" onClick={() => setSplit(null)} aria-label="No dividir" className="hover-surface p-1 -m-1" style={{ color: "var(--text-faint)" }}>
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" inputMode="decimal" placeholder="Monto de esta parte" value={split.amount} onChange={(e) => setSplit({ ...split, amount: e.target.value })} className={field} aria-label="Monto de la parte 2" />
              <select value={split.category} onChange={(e) => setSplit({ ...split, category: e.target.value })} className={field} aria-label="Categoría de la parte 2">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <input value={split.description} onChange={(e) => setSplit({ ...split, description: e.target.value })} placeholder="Qué entra en esta parte (ej. detergente)" className={field} />
            <p className="text-[11px]" style={{ color: splitAmount >= total && total > 0 ? "var(--danger)" : "var(--text-faint)" }}>
              {total > 0 && splitAmount > 0
                ? splitAmount < total
                  ? `Se cargan 2 gastos: ${currency.format(total - splitAmount)} en ${effectiveCategory ? categoryLabel(effectiveCategory) : "sin categoría"} y ${currency.format(splitAmount)} en ${categoryLabel(split.category)}.`
                  : "La parte tiene que ser menor que el total del ticket."
                : "El monto de arriba es el total del ticket; acá va solo la parte de la otra categoría."}
            </p>
          </div>
        )}

        <button type="submit" className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Plus size={17} />
          {splitValid ? "Agregar 2 gastos" : "Agregar gasto"}
        </button>

        {!split && hint?.action !== "split" && (
          <button type="button" onClick={() => setSplit(newSplit(effectiveCategory))} className="ghost-action w-full h-9 flex items-center justify-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <Split size={13} />
            Dividir ticket en 2 categorías
          </button>
        )}
      </form>
    </section>
  );
}
