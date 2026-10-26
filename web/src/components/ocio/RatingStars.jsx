import { Star } from "lucide-react";

export function RatingStars({ value, onChange, size = 15 }) {
  const stars = [1, 2, 3, 4, 5];
  const interactive = typeof onChange === "function";

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n} estrellas`}
          className={interactive ? "" : "cursor-default"}
          style={{ color: value >= n ? "var(--accent)" : "var(--border)" }}
        >
          <Star size={size} fill={value >= n ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}
