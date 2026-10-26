export function SectionHeading({ icon: Icon, children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="shrink-0" style={{ color: "var(--accent)" }} />}
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {children}
        </h2>
      </div>
      {action}
    </div>
  );
}
