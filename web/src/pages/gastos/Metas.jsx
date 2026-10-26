import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ChevronDown, Minus, Plus, Target, Trophy } from "lucide-react";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { DeleteButton } from "../../components/common/DeleteButton.jsx";
import { FieldLabel, inputClass } from "../../components/common/FieldLabel.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { getIconComponent } from "../../lib/icons.js";
import { currency, formatShortDate, todayDateInputValue } from "../../lib/format.js";
import { MONTHS_ES } from "../../lib/billing.js";

const GOAL_ICONS = ["PiggyBank", "ShieldCheck", "Plane", "Car", "Home", "GraduationCap", "Laptop", "Gift", "HeartPulse", "Coins"];
const usd = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmt = (goal, v) => (goal.currency === "USD" ? usd : currency).format(v);

function monthsUntil(dateStr) {
  const a = new Date();
  const b = new Date(dateStr + "T00:00:00");
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1);
}

/** Promedio mensual de aportes de los últimos 3 meses (para estimar cuándo llegás). */
function monthlyPace(goal) {
  const DAY = 86_400_000;
  const now = Date.now();
  const recent = goal.contributions.filter((c) => now - new Date(c.date + "T00:00:00") <= 90 * DAY);
  if (!recent.length) return 0;
  const oldest = Math.min(...recent.map((c) => new Date(c.date + "T00:00:00").getTime()));
  const months = Math.min(3, Math.max(1, (now - oldest) / (30 * DAY)));
  return recent.reduce((s, c) => s + c.amount, 0) / months;
}

function Ring({ ratio, color, size = 76, children }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-alt)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, ratio)) }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function Confetti() {
  const colors = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute rounded-sm"
          style={{ width: 6, height: 9, left: "50%", top: "40%", background: colors[i % colors.length] }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: (Math.random() - 0.5) * 320, y: Math.random() * 160 - 120, opacity: 0, rotate: Math.random() * 540 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function GoalForm({ onSubmit }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [goalCurrency, setGoalCurrency] = useState("ARS");
  const [deadline, setDeadline] = useState("");
  const [icon, setIcon] = useState("PiggyBank");

  function submit(e) {
    e.preventDefault();
    const targetAmount = parseFloat(target);
    if (!title.trim() || !targetAmount) return;
    onSubmit({ title: title.trim(), targetAmount, currency: goalCurrency, deadline: deadline || null, icon });
    setTitle("");
    setTarget("");
    setDeadline("");
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <div>
        <FieldLabel>¿Para qué ahorrás?</FieldLabel>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Ej. Vacaciones, "Fondo de emergencia"' className={inputClass()} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Objetivo</FieldLabel>
          <div className="flex gap-1">
            <select value={goalCurrency} onChange={(e) => setGoalCurrency(e.target.value)} className="rounded-lg px-2 text-sm">
              <option value="ARS">$</option>
              <option value="USD">US$</option>
            </select>
            <input type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="500000" className={inputClass()} />
          </div>
        </div>
        <div>
          <FieldLabel>Fecha límite (opcional)</FieldLabel>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass()} />
        </div>
      </div>
      <div>
        <FieldLabel>Ícono</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_ICONS.map((name) => {
            const Icon = getIconComponent(name);
            const active = icon === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setIcon(name)}
                className="flex items-center justify-center rounded-lg"
                style={{ width: 34, height: 34, background: active ? "var(--accent)" : "var(--surface-alt)", color: active ? "#fff" : "var(--text-muted)" }}
                aria-label={name}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>
      <button type="submit" className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
        <Plus size={16} />
        Crear meta
      </button>
    </form>
  );
}

function GoalCard({ goal, onContribute, onDeleteContribution, onArchive, onDelete }) {
  const [amount, setAmount] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const Icon = getIconComponent(goal.icon || "PiggyBank");
  const ratio = goal.targetAmount ? goal.saved / goal.targetAmount : 0;
  const done = ratio >= 1;
  const remaining = Math.max(0, goal.targetAmount - goal.saved);
  const color = done ? "var(--status-good)" : "var(--accent)";
  const pace = monthlyPace(goal);
  const monthsLeft = goal.deadline ? Math.max(1, monthsUntil(goal.deadline)) : null;
  const needed = monthsLeft ? remaining / monthsLeft : null;
  const etaMonths = pace > 0 ? Math.ceil(remaining / pace) : null;
  const eta = etaMonths != null ? new Date(new Date().getFullYear(), new Date().getMonth() + etaMonths, 1) : null;

  async function contribute(sign) {
    const v = parseFloat(amount);
    if (!v) return;
    const updated = await onContribute(goal.id, sign * v);
    setAmount("");
    if (!done && updated.saved >= updated.targetAmount) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1600);
    }
  }

  return (
    <Card className="relative overflow-hidden">
      {celebrate && <Confetti />}
      <div className="flex items-center gap-4">
        <Ring ratio={ratio} color={color}>
          {done ? <Trophy size={22} style={{ color }} /> : <span className="text-sm font-mono font-semibold">{Math.round(ratio * 100)}%</span>}
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon size={15} style={{ color: "var(--accent)" }} />
            <p className="text-sm font-semibold truncate">{goal.title}</p>
          </div>
          <p className="font-mono text-lg font-semibold tabular-nums leading-tight mt-0.5">
            {fmt(goal, goal.saved)}
            <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>
              {" "}
              / {fmt(goal, goal.targetAmount)}
            </span>
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {done
              ? "¡Meta cumplida!"
              : needed != null
                ? `Necesitás ${fmt(goal, needed)}/mes para llegar al ${formatShortDate(goal.deadline)}`
                : `Faltan ${fmt(goal, remaining)}`}
          </p>
          {!done && eta && (
            <p className="text-[11px]" style={{ color: needed != null && pace < needed ? "var(--status-warning)" : "var(--text-faint)" }}>
              A tu ritmo ({fmt(goal, pace)}/mes) llegás en {MONTHS_ES[eta.getMonth()]} {eta.getFullYear()}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 mt-3">
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Monto"
          className={inputClass()}
          onKeyDown={(e) => e.key === "Enter" && contribute(1)}
        />
        <button onClick={() => contribute(1)} className="flex items-center gap-1 rounded-lg px-3 text-xs font-semibold shrink-0" style={{ background: "var(--accent)", color: "#fff" }}>
          <Plus size={14} />
          Aportar
        </button>
        <button onClick={() => contribute(-1)} className="flex items-center gap-1 rounded-lg px-3 text-xs font-semibold shrink-0" style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }} title="Retirar">
          <Minus size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button onClick={() => setShowHistory((v) => !v)} className="ghost-action flex items-center gap-1 text-xs font-semibold px-2 py-1 -mx-2" style={{ color: "var(--accent-strong)" }}>
          Movimientos ({goal.contributions.length})
          <ChevronDown size={12} style={{ transform: showHistory ? "rotate(180deg)" : undefined }} />
        </button>
        <span className="flex-1" />
        {done && (
          <button onClick={() => onArchive(goal.id)} className="ghost-action flex items-center gap-1 text-xs px-2 py-1 -mr-2" style={{ color: "var(--text-faint)" }}>
            <Archive size={12} />
            Archivar
          </button>
        )}
        <DeleteButton onClick={() => onDelete(goal.id)} label="Borrar meta" />
      </div>

      <AnimatePresence initial={false}>
        {showHistory && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {goal.contributions.map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-1.5 text-xs" style={{ borderTop: "1px solid var(--border)" }}>
                <span className="font-mono" style={{ color: "var(--text-faint)" }}>
                  {formatShortDate(c.date)}
                </span>
                <span className="flex-1" />
                <span className="font-mono tabular-nums" style={{ color: c.amount >= 0 ? "var(--status-good)" : "var(--danger)" }}>
                  {c.amount >= 0 ? "+" : "−"}
                  {fmt(goal, Math.abs(c.amount))}
                </span>
                <DeleteButton onClick={() => onDeleteContribution(c.id)} label="Borrar movimiento" />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function Metas() {
  const goalsApi = useApi(api.getSavingsGoals, []);
  if (!goalsApi.data) return null;
  const goals = goalsApi.data;
  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);
  const totalSaved = active.filter((g) => g.currency === "ARS").reduce((s, g) => s + g.saved, 0);

  const replace = (updated) => goalsApi.setData((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));

  async function handleAdd(data) {
    const created = await api.addSavingsGoal(data);
    goalsApi.setData((prev) => [...prev, created]);
  }
  async function handleContribute(id, amount) {
    const updated = await api.addContribution(id, { amount, date: todayDateInputValue() });
    replace(updated);
    return updated;
  }
  async function handleDeleteContribution(id) {
    replace(await api.deleteContribution(id));
  }
  async function handleArchive(id) {
    replace(await api.updateSavingsGoal(id, { archived: true }));
  }
  async function handleDelete(id) {
    await api.deleteSavingsGoal(id);
    goalsApi.setData((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <PageTransition>
      <PageHeader title="Metas de ahorro" subtitle={active.length ? `Ahorrado en metas: ${currency.format(totalSaved)}` : "Poné nombre y número a lo que querés lograr"} />
      <div className="grid gap-4 items-start lg:grid-cols-2 [&>*]:min-w-0">
        {active.length === 0 && (
          <Card>
            <EmptyState icon={Target}>
              Todavía no tenés metas. Un buen primer paso: un "Fondo de emergencia" de 3 a 6 meses de gastos esenciales.
            </EmptyState>
          </Card>
        )}
        {active.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            onContribute={handleContribute}
            onDeleteContribution={handleDeleteContribution}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        ))}
        <Card>
          <SectionHeading icon={Plus}>Nueva meta</SectionHeading>
          <GoalForm onSubmit={handleAdd} />
        </Card>
        {archived.length > 0 && (
          <Card>
            <SectionHeading icon={Trophy}>Metas cumplidas</SectionHeading>
            {archived.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-1.5 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                <span>{g.title}</span>
                <span className="font-mono text-xs" style={{ color: "var(--status-good)" }}>
                  {fmt(g, g.saved)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
