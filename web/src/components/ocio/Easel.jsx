import { useCallback, useEffect, useState } from "react";
import { imageRendering, intervalMs } from "../../lib/ocio/gallery.js";

/** Imagen de una obra: pixel art nítido al escalar (sin difuminar). */
export function ArtworkImage({ art, thumb = false, className = "", style }) {
  return <img src={thumb ? art.thumbUrl : art.url} alt={art.title} loading={thumb ? "lazy" : undefined} draggable={false} className={`object-contain ${className}`} style={{ imageRendering: imageRendering(art), ...style }} />;
}

/**
 * Índice de la obra que se muestra, avanzando solo según el intervalo del atril ("una por día"
 * no avanza sola: arranca en la del día). `paused` frena la rotación.
 */
export function useRotation(length, { interval, startIndex = 0, paused = false }) {
  const [index, setIndex] = useState(startIndex);
  const ms = intervalMs(interval);
  useEffect(() => setIndex(length ? startIndex % length : 0), [startIndex, length]);
  useEffect(() => {
    if (!ms || paused || length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % length), ms);
    return () => clearInterval(t);
  }, [ms, paused, length]);
  const go = useCallback((delta) => setIndex((i) => (length ? (i + delta + length) % length : 0)), [length]);
  return [length ? index % length : 0, go];
}

/** Fondo a cuadros suave (deja ver la transparencia de los PNG/GIF). */
export const checker = {
  backgroundColor: "color-mix(in srgb, var(--text) 3%, var(--surface))",
  backgroundImage:
    "linear-gradient(45deg, color-mix(in srgb, var(--text) 5%, transparent) 25%, transparent 25%, transparent 75%, color-mix(in srgb, var(--text) 5%, transparent) 75%), linear-gradient(45deg, color-mix(in srgb, var(--text) 5%, transparent) 25%, transparent 25%, transparent 75%, color-mix(in srgb, var(--text) 5%, transparent) 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 8px 8px",
};

/** El atril de Inicio: una obra a la vez, rotando según la configuración. */
export function EaselFrame({ easel, height = 220 }) {
  const [hover, setHover] = useState(false);
  const [index] = useRotation(easel.items.length, { interval: easel.settings.interval, startIndex: easel.startIndex, paused: hover });
  const art = easel.items[index];
  if (!art) return null;
  return (
    <figure onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="relative rounded-xl overflow-hidden flex items-center justify-center" style={{ height, ...checker }}>
        <ArtworkImage key={art.id} art={art} className="easel-fade max-w-full max-h-full w-full h-full p-3" />
      </div>
      <figcaption className="flex items-baseline justify-between gap-3 mt-2.5">
        <span className="text-sm font-semibold truncate">{art.title}</span>
        <span className="font-mono text-[11px] shrink-0" style={{ color: "var(--text-faint)" }}>
          {art.inventoryCode}
          {easel.items.length > 1 && ` · ${index + 1}/${easel.items.length}`}
        </span>
      </figcaption>
    </figure>
  );
}
