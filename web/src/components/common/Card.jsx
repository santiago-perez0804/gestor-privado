export function Card({ children, className = "", padded = true }) {
  return (
    <div
      className={`rounded-2xl ${padded ? "p-5" : ""} ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      {children}
    </div>
  );
}
