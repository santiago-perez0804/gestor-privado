export function PrimaryButton({ children, ...rest }) {
  return (
    <button
      {...rest}
      className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors"
      style={{ background: "var(--accent)", color: "#ffffff" }}
      onMouseDown={(e) => (e.currentTarget.style.background = "var(--accent-strong)")}
      onMouseUp={(e) => (e.currentTarget.style.background = "var(--accent)")}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, ...rest }) {
  return (
    <button
      {...rest}
      className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors"
      style={{ background: "var(--surface-alt)", color: "var(--text)" }}
    >
      {children}
    </button>
  );
}
