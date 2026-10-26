export function IconChip({ icon: Icon, size = 34 }) {
  return (
    <span
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: "var(--accent-soft)", color: "var(--accent-strong)" }}
    >
      <Icon size={size * 0.47} />
    </span>
  );
}
