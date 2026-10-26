import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MONTHS_ES_ABBR } from "../../lib/billing.js";
import { currency } from "../../lib/format.js";

const SERIES = [
  { key: "income", label: "Ingresos", color: "var(--chart-cat-1)" },
  { key: "spent", label: "Gastos", color: "var(--chart-cat-2)" },
];

const compact = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
      <p className="font-semibold mb-1">{d.fullLabel}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-1.5">
          <span className="inline-block rounded-sm" style={{ width: 8, height: 8, background: s.color }} />
          <span style={{ color: "var(--text-muted)" }}>{s.label}</span>
          <span className="font-mono ml-auto pl-3">{currency.format(d[s.key])}</span>
        </p>
      ))}
      <p className="mt-1 pt-1 flex" style={{ borderTop: "1px solid var(--border)" }}>
        <span style={{ color: "var(--text-muted)" }}>{d.saved >= 0 ? "Ahorro" : "Déficit"}</span>
        <span className="font-mono ml-auto pl-3">
          {currency.format(Math.abs(d.saved))}
          {d.rate != null && ` (${Math.round(d.rate * 100)}%)`}
        </span>
      </p>
    </div>
  );
}

/** Barras agrupadas ingresos vs gastos por período (un solo eje, leyenda + tooltip). */
export function IncomeExpenseChart({ series }) {
  const data = series.map((m) => ({
    ...m,
    label: MONTHS_ES_ABBR[m.billingMonth.month],
    fullLabel: `${MONTHS_ES_ABBR[m.billingMonth.month]} ${m.billingMonth.year}`,
    income: Math.round(m.income),
    spent: Math.round(m.spent),
  }));

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block rounded-sm" style={{ width: 10, height: 10, background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div style={{ width: "100%", height: 210 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => compact.format(v)} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-alt)" }} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
