import { useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { IconPicker } from "../common/IconPicker.jsx";
import { EXPENSE_ICONS, pickExpenseIcon } from "../../lib/icons.js";
import { EXPENSE_CATEGORIES } from "../../lib/expenseCategories.js";
import { CUTOFF_DAY } from "../../lib/billing.js";

export function RecurringExpenseForm({ onAdd }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(null);
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [category, setCategory] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");

  function submit(e) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!title.trim() || !n) return;
    onAdd({
      title: title.trim(),
      description: description.trim() || null,
      amount: n,
      currency: currencyCode,
      category: category || null,
      icon,
      dayOfMonth: parseInt(dayOfMonth, 10),
    });
    setTitle("");
    setDescription("");
    setIcon(null);
    setAmount("");
    setCategory("");
    setDayOfMonth("1");
  }

  return (
    <Card>
      <SectionHeading icon={Plus}>Nueva suscripción / pago fijo</SectionHeading>
      <form onSubmit={submit} className="space-y-2.5">
        <div className="flex items-end gap-2">
          <IconPicker value={icon} autoIconName={pickExpenseIcon(title)} options={EXPENSE_ICONS} onChange={setIcon} />
          <div style={{ flex: 1 }}>
            <FieldLabel>Título</FieldLabel>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Spotify" className={inputClass()} />
          </div>
        </div>
        <div>
          <FieldLabel>Descripción (opcional)</FieldLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass()} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <FieldLabel>Monto</FieldLabel>
            <div className="flex gap-1">
              <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputClass()} />
              <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className="rounded-lg px-1 text-xs" aria-label="Moneda">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div>
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
          <div>
            <FieldLabel>Día del mes</FieldLabel>
            <input
              type="number"
              min="1"
              max="28"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className={inputClass()}
            />
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          Máximo día 28. Si cae después del cierre (día {CUTOFF_DAY}), cuenta para el período siguiente.
          {currencyCode === "USD" && " Las suscripciones en dólares se pasan a pesos al dólar tarjeta del día en que se generan (lo que cobra el banco si pagás en pesos)."}
        </p>
        <button type="submit" className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
          <Plus size={16} />
          Crear recurrente
        </button>
      </form>
    </Card>
  );
}
