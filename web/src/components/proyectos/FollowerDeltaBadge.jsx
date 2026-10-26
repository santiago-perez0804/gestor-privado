import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

const number = new Intl.NumberFormat("es-AR");

// Variación de seguidores: flecha + signo + número, para no depender solo del color.
export function FollowerDeltaBadge({ value, suffix = "" }) {
  if (value == null) {
    return (
      <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        sin datos
      </span>
    );
  }
  const positive = value > 0;
  const negative = value < 0;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const color = positive ? "var(--status-good)" : negative ? "var(--status-critical)" : "var(--text-faint)";
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold font-mono" style={{ color }}>
      <Icon size={12} />
      {positive ? "+" : ""}
      {number.format(value)}
      {suffix && <span className="font-sans font-normal ml-0.5" style={{ color: "var(--text-faint)" }}>{suffix}</span>}
    </span>
  );
}
