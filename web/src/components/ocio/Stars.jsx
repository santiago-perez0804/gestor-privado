import { Star } from "lucide-react";

/**
 * Puntuación de 0,5 a 5. Para mostrar, rellena la fracción; para editar, cada estrella tiene dos
 * mitades clickeables (izquierda = media). Volver a tocar el mismo valor lo borra.
 */
export function Stars({ value, onChange, size = 14, color = "var(--accent)" }) {
  const interactive = typeof onChange === "function";
  return (
    <div className="flex items-center gap-0.5" role={interactive ? "radiogroup" : "img"} aria-label={value ? `${String(value).replace(".", ",")} de 5 estrellas` : "Sin puntuar"}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, (value || 0) - (n - 1)));
        return (
          <span key={n} className="relative inline-flex" style={{ width: size, height: size }}>
            <Star size={size} style={{ color: "color-mix(in srgb, var(--text) 18%, transparent)" }} fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} style={{ color }} fill="currentColor" strokeWidth={0} />
              </span>
            )}
            {interactive &&
              [n - 0.5, n].map((v, i) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={value === v}
                  aria-label={`${String(v).replace(".", ",")} estrellas`}
                  onClick={() => onChange(value === v ? null : v)}
                  className="absolute top-0 h-full"
                  style={{ left: i ? "50%" : 0, width: "50%" }}
                />
              ))}
          </span>
        );
      })}
    </div>
  );
}
