import { useState } from "react";
import { Check, Landmark, LineChart, Plus, Wallet } from "lucide-react";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { DeleteButton } from "../../components/common/DeleteButton.jsx";
import { FieldLabel, inputClass } from "../../components/common/FieldLabel.jsx";
import { LineTimelineChart } from "../../components/common/LineTimelineChart.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { getIconComponent } from "../../lib/icons.js";
import { currency, formatShortDate } from "../../lib/format.js";

const ACCOUNT_TYPES = [
  { id: "banco", label: "Banco", icon: "Landmark" },
  { id: "billetera", label: "Billetera virtual", icon: "Smartphone" },
  { id: "efectivo", label: "Efectivo", icon: "Banknote" },
  { id: "inversion", label: "Inversiones", icon: "TrendingUp" },
  { id: "otro", label: "Otro", icon: "Wallet" },
];
const typeOf = (id) => ACCOUNT_TYPES.find((t) => t.id === id) ?? ACCOUNT_TYPES[4];
const usd = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmt = (acc, v) => (acc.currency === "USD" ? usd : currency).format(v);

/** Los dólares que tenés se valúan a lo que te darían por venderlos (MEP compra, o blue compra). */
function usdValue(rates) {
  return rates?.bolsa?.compra ?? rates?.blue?.compra ?? null;
}

/** Patrimonio por fecha: para cada día con cambios, suma el último saldo conocido de cada cuenta. */
function netWorthSeries(snapshots, accounts, rate) {
  const currencyOf = Object.fromEntries(accounts.map((a) => [a.id, a.currency]));
  const dates = [...new Set(snapshots.map((s) => s.date))].sort();
  const last = {};
  let i = 0;
  return dates.map((date) => {
    for (; i < snapshots.length && snapshots[i].date <= date; i++) last[snapshots[i].accountId] = snapshots[i].balance;
    const total = Object.entries(last).reduce((s, [id, bal]) => {
      const cur = currencyOf[id];
      if (!cur) return s; // cuenta borrada
      return s + (cur === "USD" ? (rate ? bal * rate : 0) : bal);
    }, 0);
    return { date: formatShortDate(date), value: Math.round(total / 1000) };
  });
}

function AccountForm({ onAdd }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("banco");
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [balance, setBalance] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd({ name: name.trim(), type, currency: currencyCode, balance: parseFloat(balance) || 0 });
    setName("");
    setBalance("");
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mercado Pago, Caja de ahorro Galicia" className={inputClass()} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <FieldLabel>Tipo</FieldLabel>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass()}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Moneda</FieldLabel>
          <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className={inputClass()}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <FieldLabel>Saldo actual</FieldLabel>
          <input type="number" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" className={inputClass()} />
        </div>
      </div>
      <button type="submit" className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
        <Plus size={16} />
        Agregar cuenta
      </button>
    </form>
  );
}

function AccountRow({ account, rate, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(account.balance));
  const Icon = getIconComponent(typeOf(account.type).icon, "Wallet");

  async function save(e) {
    e.preventDefault();
    const n = parseFloat(draft);
    if (Number.isFinite(n)) await onSave(account.id, { balance: n });
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
      <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 32, height: 32, background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{account.name}</p>
        <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
          {typeOf(account.type).label}
          {account.currency === "USD" && rate ? ` · ≈ ${currency.format(account.balance * rate)}` : ""} · actualizado {formatShortDate(account.updatedAt.slice(0, 10))}
        </p>
      </div>
      {editing ? (
        <form onSubmit={save} className="flex items-center gap-1">
          <input autoFocus type="number" inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} className="w-28 rounded-md px-2 py-1 text-sm font-mono" />
          <button type="submit" aria-label="Guardar saldo" className="p-1" style={{ color: "var(--accent-strong)" }}>
            <Check size={16} />
          </button>
        </form>
      ) : (
        <button onClick={() => setEditing(true)} title="Actualizar saldo" className="ghost-action font-mono text-sm font-semibold tabular-nums px-1.5 py-0.5 -mx-1.5">
          {fmt(account, account.balance)}
        </button>
      )}
      <DeleteButton onClick={() => onDelete(account.id)} label="Borrar cuenta" />
    </div>
  );
}

export function Cuentas() {
  const data = useApi(() => Promise.all([api.getAccounts(), api.getAccountSnapshots(), api.getExchangeRates().catch(() => null)]), []);
  if (!data.data) return null;
  const [accounts, snapshots, rates] = data.data;
  const rate = usdValue(rates);
  const active = accounts.filter((a) => !a.archived);
  const totalArs = active.filter((a) => a.currency === "ARS").reduce((s, a) => s + a.balance, 0);
  const totalUsd = active.filter((a) => a.currency === "USD").reduce((s, a) => s + a.balance, 0);
  const netWorth = totalArs + (rate ? totalUsd * rate : 0);
  const series = netWorthSeries(snapshots, accounts, rate);
  const byType = ACCOUNT_TYPES.map((t) => ({
    ...t,
    total: active.filter((a) => a.type === t.id).reduce((s, a) => s + (a.currency === "USD" ? (rate ? a.balance * rate : 0) : a.balance), 0),
  })).filter((t) => t.total > 0);

  async function add(payload) {
    await api.addAccount(payload);
    data.reload();
  }
  async function save(id, payload) {
    await api.updateAccount(id, payload);
    data.reload();
  }
  async function remove(id) {
    await api.deleteAccount(id);
    data.reload();
  }

  return (
    <PageTransition>
      <PageHeader title="Cuentas y patrimonio" subtitle="Dónde está tu plata hoy" />
      <div className="grid gap-4 items-start lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <SectionHeading icon={Wallet}>Patrimonio</SectionHeading>
          <p className="font-mono text-3xl font-semibold tabular-nums">{currency.format(netWorth)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {currency.format(totalArs)} en pesos
            {totalUsd > 0 && ` + ${usd.format(totalUsd)}${rate ? ` (a ${currency.format(rate)}, MEP compra)` : " (sin cotización)"}`}
          </p>
          {byType.length > 1 && (
            <div className="flex rounded-full overflow-hidden mt-3" style={{ height: 8 }}>
              {byType.map((t, i) => (
                <span key={t.id} title={`${t.label}: ${currency.format(t.total)}`} style={{ width: `${(t.total / netWorth) * 100}%`, background: `var(--chart-cat-${i + 1})` }} />
              ))}
            </div>
          )}
          {byType.length > 1 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {byType.map((t, i) => (
                <span key={t.id} className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: `var(--chart-cat-${i + 1})` }} />
                  {t.label} {Math.round((t.total / netWorth) * 100)}%
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionHeading icon={Landmark}>Tus cuentas</SectionHeading>
          {active.length === 0 ? (
            <EmptyState icon={Landmark}>Agregá tus cuentas (banco, billeteras, efectivo, dólares) para ver tu patrimonio total.</EmptyState>
          ) : (
            <>
              {active.map((a) => (
                <AccountRow key={a.id} account={a} rate={rate} onSave={save} onDelete={remove} />
              ))}
              <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
                Tocá un saldo para actualizarlo. Conviene hacerlo una vez por semana o al cerrar cada período: así se arma la evolución.
              </p>
            </>
          )}
        </Card>

        {series.length >= 2 && (
          <Card className="lg:col-span-2">
            <SectionHeading icon={LineChart}>Evolución (miles de $)</SectionHeading>
            <LineTimelineChart data={series} unit=" mil" />
            <p className="text-[11px] mt-1" style={{ color: "var(--text-faint)" }}>
              Los dólares se valúan siempre a la cotización de hoy.
            </p>
          </Card>
        )}

        <Card>
          <SectionHeading icon={Plus}>Nueva cuenta</SectionHeading>
          <AccountForm onAdd={add} />
        </Card>
      </div>
    </PageTransition>
  );
}
