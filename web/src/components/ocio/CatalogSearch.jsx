import { useEffect, useRef, useState } from "react";
import { Check, KeyRound, Loader2, Search, WifiOff } from "lucide-react";
import { WorkCover } from "./WorkCover.jsx";
import { api } from "../../lib/api.js";
import { statusLabel } from "../../lib/ocio/types.js";

const SOURCE_NAME = { tmdb: "TMDB", openlibrary: "Open Library", googlebooks: "Google Books", rawg: "RAWG" };
const SOURCE_LINK = { tmdb: "https://www.themoviedb.org", openlibrary: "https://openlibrary.org", googlebooks: "https://books.google.com", rawg: "https://rawg.io" };

/** Línea de datos del resultado: "Denis Villeneuve · 2021 · 155 min". */
function resultMeta(r) {
  const extra =
    r.extra?.runtime ? `${r.extra.runtime} min` : r.extra?.pages ? `${r.extra.pages} págs` : r.extra?.seasons ? `${r.extra.seasons} temporada${r.extra.seasons === 1 ? "" : "s"}` : r.extra?.platforms?.length ? r.extra.platforms.slice(0, 3).join(", ") : null;
  return [[r.creators?.[0], r.year].filter(Boolean).join(" · "), extra].filter(Boolean);
}

/** Resultado del catálogo → borrador editable del modal. */
export function resultToDraft(r) {
  const e = r.extra || {};
  const extra = e.pages ?? e.runtime ?? e.seasons ?? (e.platforms?.length ? e.platforms.join(", ") : "");
  return {
    title: r.title || "",
    originalTitle: r.originalTitle || null,
    creators: (r.creators || []).join(", "),
    year: r.year ? String(r.year) : "",
    genres: r.genres || [],
    extra: extra ?? "",
    cover: r.cover || null,
    externalSource: r.externalSource,
    externalId: r.externalId,
    metadata: { ...(r.alsoIn ? { alsoIn: r.alsoIn } : {}), ...(r.overview ? { overview: r.overview } : {}) },
  };
}

/**
 * Buscador de la pantalla "Agregar": espera ~300 ms después de la última tecla, cancela el pedido
 * anterior y muestra los resultados normalizados. Elegir uno completa el borrador.
 */
export function CatalogSearch({ type, selectedId, onSelect, onManual }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ status: "idle", results: [], configured: true });
  const controller = useRef(null);

  useEffect(() => {
    setState({ status: "idle", results: [], configured: true });
  }, [type]);

  useEffect(() => {
    const q = query.trim();
    controller.current?.abort();
    if (q.length < 2) {
      setState((s) => ({ ...s, status: "idle", results: [] }));
      return;
    }
    const ctrl = new AbortController();
    controller.current = ctrl;
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, status: "loading" }));
      try {
        const r = await api.searchCatalog(type, q, ctrl.signal);
        if (!ctrl.signal.aborted) setState({ status: "done", results: r.results, configured: r.configured, missingKey: r.missingKey, errors: r.errors });
      } catch (err) {
        if (!ctrl.signal.aborted) setState({ status: "error", results: [], configured: true, error: err.message });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, type]);

  async function pick(r) {
    onSelect(resultToDraft(r), r);
    // Si el resultado vino sin detalle (más abajo en la lista), se completa con director, duración, etc.
    if (!r.creators?.length && (r.externalSource === "tmdb" || r.externalSource === "rawg")) {
      const full = await api.getCatalogDetails(type, r.externalSource, r.externalId).catch(() => null);
      if (full) onSelect(resultToDraft({ ...full, inLibrary: r.inLibrary }), r);
    }
  }

  const sources = [...new Set(state.results.map((r) => r.externalSource))];
  return (
    <div className="flex flex-col h-full min-h-[18rem]">
      <label className="relative block">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={type === "book" ? "Título o autor…" : type === "game" ? "Nombre del juego…" : "Título…"}
          aria-label="Buscar en el catálogo"
          className="w-full h-11 rounded-xl pl-10 pr-10 text-[15px]"
        />
        {state.status === "loading" && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "var(--text-faint)" }} />}
      </label>

      <div className="flex justify-between gap-3 text-[11px] mt-2 mb-2" style={{ color: "var(--text-faint)" }}>
        <span>{state.status === "done" ? `${state.results.length} resultado${state.results.length === 1 ? "" : "s"}${sources.length ? ` de ${sources.map((s) => SOURCE_NAME[s]).join(" + ")}` : ""}` : " "}</span>
        <span>Portada, año y géneros se completan solos</span>
      </div>

      {!state.configured ? (
        <div className="rounded-xl p-4 text-sm" style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--text)" }}>
            <KeyRound size={15} />
            Falta configurar el catálogo
          </p>
          <p className="mt-1.5 text-xs leading-relaxed">
            Para buscar {type === "game" ? "juegos" : "películas y series"} agregá <code className="font-mono">{state.missingKey}</code> en el archivo <code className="font-mono">.env</code> y reiniciá la app. Mientras tanto, podés cargarlo a mano.
          </p>
        </div>
      ) : state.status === "error" ? (
        <p className="flex items-start gap-2 rounded-xl p-4 text-sm" style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
          <WifiOff size={15} className="shrink-0 mt-0.5" />
          No se pudo consultar el catálogo (¿sin conexión?). Podés cargarlo a mano y completar la portada después.
        </p>
      ) : (
        <ul className="thin-scroll flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-1.5 max-h-[24rem]">
          {state.results.map((r) => {
            const selected = selectedId === `${r.externalSource}:${r.externalId}`;
            return (
              <li key={`${r.externalSource}:${r.externalId}`}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  aria-pressed={selected}
                  className="card-hover w-full flex items-center gap-3 rounded-xl p-2 text-left"
                  style={{ border: `1px solid ${selected ? "color-mix(in srgb, var(--accent) 60%, var(--border))" : "var(--border)"}`, background: selected ? "color-mix(in srgb, var(--accent) 9%, transparent)" : undefined }}
                >
                  <WorkCover item={{ title: r.title, cover: r.cover, type: r.type }} size="thumb" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">{r.title}</span>
                    {resultMeta(r).map((line) => (
                      <span key={line} className="block text-xs truncate font-mono" style={{ color: "var(--text-faint)" }}>
                        {line}
                      </span>
                    ))}
                  </span>
                  {r.inLibrary ? (
                    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0" style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }} title={statusLabel(r.type, r.inLibrary.status)}>
                      Ya en tu biblioteca
                    </span>
                  ) : selected ? (
                    <Check size={16} className="shrink-0" style={{ color: "var(--accent)" }} />
                  ) : null}
                </button>
              </li>
            );
          })}
          {state.status === "done" && state.results.length === 0 && (
            <li className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
              No encontramos nada con “{query.trim()}”.
            </li>
          )}
        </ul>
      )}

      {(type === "movie" || type === "series") && (
        <p className="text-[10px] mt-3" style={{ color: "var(--text-faint)" }}>
          Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
        </p>
      )}
      <div className="mt-auto pt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span style={{ color: "var(--text-faint)" }}>
          ¿No aparece?{" "}
          <button type="button" onClick={() => onManual(query.trim())} className="ghost-action font-semibold px-1 -mx-1" style={{ color: "var(--accent-strong)" }}>
            Cargalo a mano
          </button>
        </span>
        <span style={{ color: "var(--text-faint)" }}>
          Datos de{" "}
          {(type === "book" ? ["openlibrary", "googlebooks"] : type === "game" ? ["rawg"] : ["tmdb"]).map((s, i) => (
            <span key={s}>
              {i > 0 && " · "}
              <a href={SOURCE_LINK[s]} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                {SOURCE_NAME[s]}
              </a>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
