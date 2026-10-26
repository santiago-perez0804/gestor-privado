import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Pause, Play, X } from "lucide-react";
import { WorkCover } from "../../components/ocio/WorkCover.jsx";
import { Stars } from "../../components/ocio/Stars.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { currency, todayDateInputValue } from "../../lib/format.js";
import { MONTHS_ES } from "../../lib/billing.js";
import { TYPE_ORDER, WORK_TYPES } from "../../lib/ocio/types.js";
import { categoryInfo, dayMonthYear } from "../../lib/ocio/outings.js";
import { useOcio } from "./OcioContext.jsx";

const SLIDE_MS = 6500;
const fmt1 = (n) => String(n).replace(".", ",");
const bg = (color) => `radial-gradient(120% 80% at 20% 0%, color-mix(in srgb, ${color} 55%, #0d1110) 0%, #0d1110 70%)`;
const plural = (n, one, many) => `${n.toLocaleString("es-AR")} ${n === 1 ? one : many}`;

function Big({ children }) {
  return <p className="font-serif text-6xl sm:text-7xl leading-none tracking-tight">{children}</p>;
}
function Kicker({ children }) {
  return <p className="text-xs uppercase tracking-[0.18em] mb-5 opacity-70">{children}</p>;
}
function Line({ children, className = "" }) {
  return <p className={`text-lg sm:text-xl leading-snug mt-5 opacity-90 ${className}`}>{children}</p>;
}

/**
 * Diapositivas del resumen a partir de los datos del año. Las que no tienen datos no aparecen
 * (sin lectura no hay "páginas", sin salidas no hay "salidas", etc.).
 */
export function buildSlides(w, { genreLabel, isCurrent }) {
  const slides = [];
  const add = (id, color, body) => slides.push({ id, color, body });
  const empty = !w.totalFinished && !w.reading.pages && !w.outings.count && !w.artworks;

  add("intro", "var(--accent)", (
    <>
      <Kicker>Resumen anual</Kicker>
      <p className="font-serif text-5xl sm:text-6xl leading-[1.05]">Tu {w.year} en Ocio</p>
      {empty ? (
        <Line>Todavía no hay nada registrado en {w.year}. Cuando termines algo, este resumen se arma solo.</Line>
      ) : (
        <Line>
          {w.totalFinished ? <>Terminaste <b>{plural(w.totalFinished, "cosa", "cosas")}</b> entre películas, series, libros y videojuegos.</> : "Un año para mirar."}
          {isCurrent && <span className="block text-sm mt-2 opacity-70">Hasta hoy: el año todavía no terminó.</span>}
        </Line>
      )}
    </>
  ));
  if (empty) return slides;

  if (w.totalFinished) {
    const max = Math.max(1, ...TYPE_ORDER.map((t) => w.finishedCount[t]));
    add("types", "var(--ocio-movie)", (
      <>
        <Kicker>Lo que terminaste</Kicker>
        <ul className="space-y-5">
          {TYPE_ORDER.map((t) => (
            <li key={t}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg">{WORK_TYPES[t].plural}</span>
                <span className="font-mono text-3xl font-semibold">{w.finishedCount[t]}</span>
              </div>
              <span className="block h-2 rounded-full mt-2" style={{ background: "rgba(255,255,255,.12)" }}>
                <span className="block h-full rounded-full" style={{ width: `${(w.finishedCount[t] / max) * 100}%`, background: WORK_TYPES[t].color }} />
              </span>
            </li>
          ))}
        </ul>
      </>
    ));
  }

  if (w.topGenre?.count >= 2) {
    add("genre", "var(--ocio-series)", (
      <>
        <Kicker>Tu género del año</Kicker>
        <Big>{genreLabel(w.topGenre.id)}</Big>
        <Line>Aparece en {w.topGenre.count} de las {w.totalFinished} cosas que terminaste.</Line>
      </>
    ));
  }

  if (w.favoriteMonth?.total >= 2) {
    add("month", "var(--ocio-game)", (
      <>
        <Kicker>Tu mes más intenso</Kicker>
        <Big>
          <span className="capitalize">{MONTHS_ES[w.favoriteMonth.month]}</span>
        </Big>
        <Line>Terminaste {plural(w.favoriteMonth.total, "cosa", "cosas")} en un solo mes.</Line>
      </>
    ));
  }

  if (w.reading.pages) {
    const r = w.reading;
    add("reading", "var(--ocio-book)", (
      <>
        <Kicker>Leyendo</Kicker>
        <Big>{r.pages.toLocaleString("es-AR")}</Big>
        <p className="text-xl mt-2 opacity-80">páginas</p>
        <Line>
          {r.hours ? <>En {plural(r.hours, "hora", "horas")} de lectura, a {r.pagesPerHour} páginas por hora. </> : null}
          Leíste {plural(r.daysWithReading, "día", "días")} y tu mejor racha fue de {plural(r.bestStreak, "día", "días")} seguidos.
        </Line>
        {r.nightShare >= 0.5 && <Line className="text-base opacity-75">Y casi siempre de noche: {Math.round(r.nightShare * 10)} de cada 10 sesiones.</Line>}
      </>
    ));
  }

  if (w.movieHours) {
    add("movies", "var(--ocio-movie)", (
      <>
        <Kicker>En el cine (o en el sillón)</Kicker>
        <Big>{w.movieHours}</Big>
        <p className="text-xl mt-2 opacity-80">horas de películas</p>
        <Line>{w.movieHours >= 24 ? <>Eso es más de {plural(Math.floor(w.movieHours / 24), "día entero", "días enteros")} mirando la pantalla.</> : <>{plural(w.finishedCount.movie, "película", "películas")} en el año.</>}</Line>
      </>
    ));
  }

  if (w.best.length) {
    add("best", "var(--accent)", (
      <>
        <Kicker>Lo que más te gustó</Kicker>
        <ol className="space-y-4">
          {w.best.map((b, i) => (
            <li key={b.entryId} className="flex items-center gap-4">
              <span className="font-mono text-sm opacity-60 w-4">{i + 1}</span>
              <WorkCover item={b} size="tile" />
              <span className="min-w-0">
                <span className="block font-serif text-2xl leading-tight truncate">{b.title}</span>
                <span className="flex items-center gap-2 mt-1 text-sm opacity-80">
                  {WORK_TYPES[b.type]?.label}
                  <Stars value={b.rating} size={13} color="#f3c969" />
                </span>
              </span>
            </li>
          ))}
        </ol>
        {w.averageRating != null && <Line className="text-base opacity-75">Tu puntuación promedio fue {fmt1(w.averageRating)}.</Line>}
      </>
    ));
  }

  if (w.first && w.last && w.totalFinished >= 2) {
    add("firstlast", "var(--ocio-series)", (
      <>
        <Kicker>De punta a punta</Kicker>
        <div className="space-y-6">
          {[
            ["Arrancaste con", w.first],
            [isCurrent ? "Lo último, por ahora" : "Y cerraste con", w.last],
          ].map(([label, x]) => (
            <div key={label} className="flex items-center gap-4">
              <WorkCover item={x} size="tile" />
              <span className="min-w-0">
                <span className="block text-sm opacity-70">{label}</span>
                <span className="block font-serif text-2xl leading-tight truncate">{x.title}</span>
                <span className="block text-sm opacity-70">{dayMonthYear(x.date)}</span>
              </span>
            </div>
          ))}
        </div>
      </>
    ));
  }

  if (w.outings.count) {
    // "Sobre todo de…" solo si la categoría se repite (con una sola no dice nada).
    const cat = w.outings.topCategory?.count >= 2 ? categoryInfo(w.outings.topCategory.id) : null;
    add("outings", cat?.color ?? "var(--accent)", (
      <>
        <Kicker>Salidas</Kicker>
        <Big>{w.outings.count}</Big>
        <p className="text-xl mt-2 opacity-80">{w.outings.count === 1 ? "salida" : "salidas"}</p>
        <Line>
          {cat && <>Sobre todo de <b>{cat.label.toLowerCase()}</b> ({w.outings.topCategory.count}). </>}
          {w.outings.spent > 0 && <>Gastaste {currency.format(w.outings.spent)} en ellas, según los gastos que vinculaste.</>}
        </Line>
      </>
    ));
  }

  if (w.artworks) {
    add("art", "#d4a23c", (
      <>
        <Kicker>Creación</Kicker>
        <Big>{w.artworks}</Big>
        <Line>{w.artworks === 1 ? "obra de pixel art nueva en tu galería." : "obras de pixel art nuevas en tu galería."}</Line>
      </>
    ));
  }

  add("outro", "var(--accent)", (
    <>
      <Kicker>Eso fue</Kicker>
      <p className="font-serif text-5xl sm:text-6xl leading-[1.05]">Tu {w.year}</p>
      <Line>{isCurrent ? "Y todavía queda año. Volvé en diciembre para ver cómo cierra." : "Gracias por llevar la cuenta."}</Line>
    </>
  ));
  return slides;
}

/** La historia a pantalla completa: barras de progreso, tocar a los costados, Escape para salir. */
export function Story({ slides, onClose, footer }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pressAt = useRef(0);
  const last = slides.length - 1;
  const go = useCallback((delta) => setIndex((i) => Math.max(0, Math.min(last, i + delta))), [last]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const slide = slides[index];
  // Tocar: tercio izquierdo vuelve, el resto avanza. Mantener apretado pausa.
  const onPointerDown = () => {
    pressAt.current = Date.now();
    setPaused(true);
  };
  const onPointerUp = (e) => {
    setPaused(false);
    if (Date.now() - pressAt.current > 300) return;
    const rect = e.currentTarget.getBoundingClientRect();
    go(e.clientX - rect.left < rect.width / 3 ? -1 : 1);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: "#070908" }} role="dialog" aria-modal="true" aria-label="Resumen anual">
      <div className="relative w-full h-full sm:h-[min(92vh,820px)] sm:w-auto sm:aspect-[9/16] sm:rounded-3xl overflow-hidden text-white select-none" style={{ background: bg(slide.color), transition: "background .5s ease" }}>
        <div className="absolute top-0 inset-x-0 z-10 px-3 pt-3">
          <div className="flex gap-1">
            {slides.map((s, i) => (
              <span key={s.id} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.25)" }}>
                <span
                  key={i === index ? `on-${index}` : "off"}
                  className={`block h-full origin-left ${i === index ? "story-progress" : ""}`}
                  style={{
                    background: "#fff",
                    transform: i < index ? "scaleX(1)" : i > index ? "scaleX(0)" : undefined,
                    "--story-ms": `${SLIDE_MS}ms`,
                    animationPlayState: paused ? "paused" : "running",
                  }}
                  onAnimationEnd={() => i === index && index < last && go(1)}
                />
              </span>
            ))}
          </div>
          <div className="flex items-center justify-end gap-1 mt-2">
            <button onClick={() => setPaused((p) => !p)} className="p-2 rounded-full opacity-80 hover:opacity-100" aria-label={paused ? "Seguir" : "Pausar"}>
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button onClick={onClose} className="p-2 rounded-full opacity-80 hover:opacity-100" aria-label="Cerrar (Esc)">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="absolute inset-0 cursor-pointer" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={() => setPaused(false)} aria-hidden="true" />
        <div key={slide.id} className="story-slide relative h-full flex flex-col justify-center px-8 sm:px-10 pointer-events-none">
          {slide.body}
        </div>
        {index === last && footer && <div className="absolute bottom-0 inset-x-0 z-10 p-6 flex flex-wrap gap-2 justify-center">{footer}</div>}
        <p className="sr-only" aria-live="polite">
          Diapositiva {index + 1} de {slides.length}
        </p>
      </div>
    </div>
  );
}

export function ResumenAnual() {
  const { genreLabel } = useOcio();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const today = todayDateInputValue();
  const currentYear = Number(today.slice(0, 4));
  const year = Number(params.get("anio")) || currentYear;
  const wrappedApi = useApi(() => api.getOcioWrapped(year), [year]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const close = useCallback(() => (location.key !== "default" ? navigate(-1) : navigate("/ocio/estadisticas")), [location.key, navigate]);
  const w = wrappedApi.data;
  const slides = useMemo(() => (w && w.year === year ? buildSlides(w, { genreLabel, isCurrent: year === currentYear }) : null), [w, year, genreLabel, currentYear]);

  if (!mounted) return null;
  const footer = (
    <>
      <Link to="/ocio/estadisticas" className="h-10 px-4 inline-flex items-center rounded-full text-sm font-semibold bg-white text-black">
        Ver estadísticas
      </Link>
      {[currentYear - 1, currentYear]
        .filter((y) => y !== year)
        .map((y) => (
          <button key={y} onClick={() => setParams({ anio: String(y) }, { replace: true })} className="h-10 px-4 rounded-full text-sm font-semibold" style={{ border: "1px solid rgba(255,255,255,.4)" }}>
            Ver {y}
          </button>
        ))}
    </>
  );
  return createPortal(
    slides ? (
      <Story key={year} slides={slides} onClose={close} footer={footer} />
    ) : (
      <div className="fixed inset-0 z-[80] flex items-center justify-center text-white" style={{ background: "#070908" }}>
        {wrappedApi.error ? (
          <div className="text-center">
            <p>No se pudo armar el resumen.</p>
            <button onClick={close} className="mt-4 underline">
              Volver
            </button>
          </div>
        ) : (
          <span className="opacity-60 text-sm">Armando tu resumen…</span>
        )}
      </div>
    ),
    document.body
  );
}
