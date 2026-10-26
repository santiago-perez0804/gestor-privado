/** Selector de año (2025 | 2026) de las pantallas de Ocio. */
export function YearToggle({ years, value, onChange }) {
  return (
    <div className="flex rounded-xl p-1 gap-0.5" style={{ border: "1px solid var(--border)" }}>
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onChange(y)}
          aria-pressed={value === y}
          className="h-8 px-3 rounded-lg text-sm font-mono"
          style={{ background: value === y ? "var(--surface-alt)" : "transparent", color: value === y ? "var(--text)" : "var(--text-faint)", fontWeight: value === y ? 600 : 500 }}
        >
          {y}
        </button>
      ))}
    </div>
  );
}
