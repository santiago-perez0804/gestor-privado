import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, X } from "lucide-react";
import { ArtworkImage, useRotation } from "../../components/ocio/Easel.jsx";
import { api } from "../../lib/api.js";
import { artworkCaption } from "../../lib/ocio/gallery.js";

const REFRESH_MS = 5 * 60_000;

/**
 * Modo museo: una obra a pantalla completa, con su rótulo, rotando según el atril.
 * Vive fuera del marco de la app (sin barra lateral) para poder abrirse como widget de escritorio:
 * `/museo?widget=1` oculta el botón de cerrar y achica el rótulo.
 * Teclas: ← → cambian, Espacio pausa, F pantalla completa, Escape sale.
 * `initialEasel` permite arrancar con datos ya cargados (se usa al renderizar en las pruebas).
 */
export function ModoMuseo({ initialEasel = null }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const widget = params.get("widget") === "1";
  const [easel, setEasel] = useState(initialEasel);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const idleTimer = useRef(null);

  // Datos del atril; se refrescan cada tanto para que el widget vea obras nuevas sin recargar.
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .getEasel()
        .then((e) => alive && (setEasel(e), setError(null)))
        .catch((e) => alive && setError(e));
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const items = easel?.items ?? [];
  const [index, go] = useRotation(items.length, { interval: easel?.settings.interval, startIndex: easel?.startIndex ?? 0, paused });
  const art = items[index];

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    navigate("/ocio/galeria");
  }, [navigate]);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  // Los controles se esconden si el mouse no se mueve (para que quede solo la obra).
  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 2500);
  }, []);

  useEffect(() => {
    wake();
    return () => clearTimeout(idleTimer.current);
  }, [wake]);

  useEffect(() => {
    const onKey = (e) => {
      wake();
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "Escape" && !document.fullscreenElement && !widget) exit();
    };
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = overflow;
    };
  }, [go, exit, toggleFullscreen, wake, widget]);

  const controls = `transition-opacity duration-300 ${idle ? "opacity-0 pointer-events-none" : "opacity-100"}`;
  const btn = "w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10";

  return (
    <div className="fixed inset-0 z-[80] select-none text-white" style={{ background: "#0b0d0c", cursor: idle ? "none" : undefined }} onMouseMove={wake} role="region" aria-label="Modo museo">
      {art ? (
        <>
          <div className="absolute inset-0 flex items-center justify-center" style={{ padding: widget ? "4% 4% 18%" : "5vh 6vw 16vh" }}>
            <ArtworkImage key={art.id} art={art} className="easel-fade w-full h-full" style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,.6))" }} />
          </div>
          {/* Rótulo de museo */}
          <div className={`absolute left-0 bottom-0 ${widget ? "p-3" : "p-6 sm:p-10"}`}>
            <div className={`rounded-lg ${widget ? "px-3 py-2" : "px-5 py-4"} max-w-[min(28rem,80vw)]`} style={{ background: "#f4f1ea", color: "#1b1b1b", boxShadow: "0 10px 30px -10px rgba(0,0,0,.6)" }}>
              <p className={`font-serif leading-tight ${widget ? "text-base" : "text-2xl"}`}>{art.title}</p>
              {artworkCaption(art) && <p className={`mt-1 ${widget ? "text-[11px]" : "text-sm"}`} style={{ color: "#555" }}>{artworkCaption(art)}</p>}
              {!widget && art.description && <p className="text-sm mt-2 leading-snug" style={{ color: "#333" }}>{art.description}</p>}
              <p className="font-mono text-[11px] mt-1.5" style={{ color: "#777" }}>
                {art.inventoryCode}
              </p>
            </div>
          </div>
          {items.length > 1 && (
            <>
              <button onClick={() => go(-1)} aria-label="Anterior" className={`absolute left-3 top-1/2 -translate-y-1/2 ${btn} ${controls}`}>
                <ChevronLeft size={26} />
              </button>
              <button onClick={() => go(1)} aria-label="Siguiente" className={`absolute right-3 top-1/2 -translate-y-1/2 ${btn} ${controls}`}>
                <ChevronRight size={26} />
              </button>
            </>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
          <p className="font-serif text-3xl">{error ? "No se pudo cargar el atril" : easel ? "El atril está vacío" : ""}</p>
          {easel && !error && <p className="text-sm opacity-70">{easel.total ? "Ninguna obra está marcada para el atril." : "Subí tus dibujos en la Galería."}</p>}
        </div>
      )}

      <div className={`absolute top-0 right-0 flex items-center gap-1 p-3 ${controls}`}>
        {items.length > 1 && (
          <span className="font-mono text-xs opacity-60 mr-2">
            {index + 1} / {items.length}
          </span>
        )}
        {items.length > 1 && (
          <button onClick={() => setPaused((p) => !p)} aria-label={paused ? "Seguir" : "Pausar"} className={btn}>
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        )}
        <button onClick={toggleFullscreen} aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa (F)"} className={btn}>
          {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
        {!widget && (
          <button onClick={exit} aria-label="Salir del modo museo (Esc)" className={btn}>
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
