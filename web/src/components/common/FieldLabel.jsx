export function FieldLabel({ children }) {
  return (
    <span className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
      {children}
    </span>
  );
}

export function inputClass() {
  return "w-full rounded-lg px-3 py-2 text-sm";
}
