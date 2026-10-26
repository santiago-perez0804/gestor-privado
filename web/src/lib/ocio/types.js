// Vocabulario de Ocio en la interfaz: tipos de obra, estados (con el verbo de cada tipo),
// formato del progreso y portadas generadas cuando no hay imagen.
import { BookOpen, Clapperboard, Gamepad2, Tv } from "lucide-react";

export const WORK_TYPES = {
  movie: { label: "Película", plural: "Películas", slug: "peliculas", color: "var(--ocio-movie)", icon: Clapperboard, creator: "Dirección", verb: { want: "Quiero ver", in_progress: "Viendo", done: "Vista", dropped: "Abandonada" } },
  series: { label: "Serie", plural: "Series", slug: "series", color: "var(--ocio-series)", icon: Tv, creator: "Creación", verb: { want: "Quiero ver", in_progress: "Viendo", done: "Terminada", dropped: "Abandonada" } },
  book: { label: "Libro", plural: "Libros", slug: "libros", color: "var(--ocio-book)", icon: BookOpen, creator: "Autor", verb: { want: "Quiero leer", in_progress: "Leyendo", done: "Leído", dropped: "Abandonado" } },
  game: { label: "Videojuego", plural: "Videojuegos", slug: "videojuegos", color: "var(--ocio-game)", icon: Gamepad2, creator: "Estudio", verb: { want: "Quiero jugar", in_progress: "Jugando", done: "Terminado", dropped: "Abandonado" } },
};

export const TYPE_ORDER = ["movie", "series", "book", "game"];
export const typeBySlug = (slug) => TYPE_ORDER.find((t) => WORK_TYPES[t].slug === slug) ?? null;

/** Estados genéricos (para filtros que mezclan tipos). */
export const STATUS_LABELS = { want: "Quiero", in_progress: "En curso", done: "Terminado", dropped: "Abandonado" };
export const STATUS_ORDER = ["in_progress", "done", "want", "dropped"];

export const statusLabel = (type, status) => WORK_TYPES[type]?.verb[status] ?? STATUS_LABELS[status];

/** Unidades de progreso por tipo. */
export const PROGRESS_UNITS = {
  page: { label: "Página", short: "p." },
  episode: { label: "Episodio", short: "ep." },
  hours: { label: "Horas jugadas", short: "h" },
  minute: { label: "Minuto", short: "min" },
};
export const DEFAULT_UNIT = { book: "page", series: "episode", game: "hours", movie: "minute" };

/** Fracción 0..1 del progreso, o null si no se puede saber. */
export function progressRatio(progress) {
  if (!progress || progress.current == null || !progress.total) return null;
  return Math.max(0, Math.min(1, progress.current / progress.total));
}

/** "p. 142 de 256" · "T2 · E4 / 10" · "18 h jugadas" · "40 / 124 min". */
export function progressText(progress, type) {
  if (!progress || progress.current == null) return null;
  const unit = progress.unit || DEFAULT_UNIT[type];
  const { current, total, season } = progress;
  if (unit === "page") return total ? `p. ${current} de ${total}` : `p. ${current}`;
  if (unit === "episode") return `${season ? `T${season} · ` : ""}E${current}${total ? ` / ${total}` : ""}`;
  if (unit === "hours") return `${current} h jugadas${progress.note ? ` · ${progress.note}` : ""}`;
  return total ? `${current} / ${total} min` : `${current} min`;
}

// Portadas generadas: fondo de una paleta "editorial" según el título (siempre el mismo color).
const COVER_PALETTE = [
  { bg: "#2f4a3e", fg: "#f1ead8" },
  { bg: "#3f3260", fg: "#f1ead8" },
  { bg: "#4a2a26", fg: "#f3d7a6" },
  { bg: "#22344a", fg: "#e9eef5" },
  { bg: "#5a1f1f", fg: "#f6e7dc" },
  { bg: "#e8e0cc", fg: "#2a2420" },
  { bg: "#6b4a1f", fg: "#f6e2bf" },
  { bg: "#2c4b57", fg: "#e7f1f2" },
  { bg: "#4a1d2a", fg: "#f5c2a0" },
  { bg: "#c9894a", fg: "#2a1a0c" },
  { bg: "#3a2b4a", fg: "#e6b8ff" },
  { bg: "#1f3a33", fg: "#bfe8d6" },
];

export function coverColors(title = "") {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return COVER_PALETTE[h % COVER_PALETTE.length];
}

/** Primera letra visible del título (para miniaturas): "1984" → "1", "El viaje…" → "E". */
export const initialOf = (title = "") => (title.trim()[0] || "?").toUpperCase();

/** "Libro · 1932". */
export const typeAndYear = (item) => [WORK_TYPES[item.type]?.label, item.year].filter(Boolean).join(" · ");
