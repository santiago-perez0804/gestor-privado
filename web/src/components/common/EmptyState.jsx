export function EmptyState({ icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      {Icon && <Icon size={22} style={{ color: "var(--text-faint)" }} />}
      <p className="text-sm" style={{ color: "var(--text-faint)" }}>
        {children}
      </p>
    </div>
  );
}
