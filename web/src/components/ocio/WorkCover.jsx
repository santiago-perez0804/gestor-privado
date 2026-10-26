import { useState } from "react";
import { WORK_TYPES, coverColors, initialOf } from "../../lib/ocio/types.js";

/**
 * Portada de una obra. Con imagen (descargada o del catálogo) la muestra; si no hay o falla,
 * dibuja una portada "editorial" con el título y el autor en el color de la obra.
 *  - size "thumb" / "tile": rectangulito con la inicial (listas, reseñas, "en curso").
 *  - size "card": proporción 2:3 con título y autor (grillas).
 *  - size "hero": la grande del detalle, con un rótulo arriba (el género).
 */
export function WorkCover({ item, size = "card", label, badge = false, className = "" }) {
  const [broken, setBroken] = useState(false);
  const { bg, fg } = coverColors(item.title);
  const type = WORK_TYPES[item.type];
  const hasImage = item.cover && !broken;

  if (size === "thumb" || size === "tile") {
    const [w, h] = size === "tile" ? [60, 84] : [40, 56];
    return (
      <span
        className={`flex items-center justify-center rounded-md shrink-0 overflow-hidden font-serif ${className}`}
        style={{ width: w, height: h, background: bg, color: fg, border: "1px solid color-mix(in srgb, var(--text) 8%, transparent)" }}
        aria-hidden="true"
      >
        {hasImage ? <img src={item.cover} alt="" loading="lazy" onError={() => setBroken(true)} className="w-full h-full object-cover" /> : <span className={size === "tile" ? "text-3xl" : "text-xl"}>{initialOf(item.title)}</span>}
      </span>
    );
  }

  const hero = size === "hero";
  return (
    <div
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ aspectRatio: "2 / 3", background: bg, color: fg, boxShadow: hero ? "0 18px 40px -18px rgba(0,0,0,.55)" : "0 6px 18px -12px rgba(0,0,0,.5)" }}
    >
      {hasImage ? (
        <img src={item.cover} alt={`Portada de ${item.title}`} loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className={`absolute inset-0 flex flex-col justify-end ${hero ? "p-5" : "p-3"}`}>
          {label && (
            <p className={`absolute ${hero ? "top-5 left-5" : "top-3 left-3"} text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80`}>{label}</p>
          )}
          <p className={`font-serif leading-[1.05] ${hero ? "text-5xl" : "text-[1.35rem]"}`} style={{ textWrap: "balance" }}>
            {item.title}
          </p>
          {item.creators?.[0] && (
            <p className={`font-semibold uppercase tracking-[0.12em] opacity-85 border-t ${hero ? "text-xs mt-4 pt-3" : "text-[9px] mt-2.5 pt-2"}`} style={{ borderColor: "color-mix(in srgb, currentColor 30%, transparent)" }}>
              {item.creators[0]}
            </p>
          )}
        </div>
      )}
      {badge && type && (
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(10,14,12,.62)", color: "#f1f1ec", backdropFilter: "blur(4px)" }}>
          <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: type.color }} />
          {type.label}
        </span>
      )}
    </div>
  );
}
