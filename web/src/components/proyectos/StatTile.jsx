export function StatTile({ label, value, children }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--surface-alt)" }}>
      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      {value !== undefined && <p className="text-lg font-semibold font-mono leading-tight mt-0.5">{value ?? "—"}</p>}
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}
