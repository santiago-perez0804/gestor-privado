import { useCallback, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "../../components/common/ErrorBoundary.jsx";
import { ModuleTabStrip } from "../../components/common/ModuleTabStrip.jsx";
import { useSidebarBadges } from "../../components/common/AppShell.jsx";
import { AddToLibraryModal } from "../../components/ocio/AddToLibraryModal.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { OcioContext } from "./OcioContext.jsx";

/** Marco de Ocio: contadores de la barra lateral, géneros y el modal "Agregar" compartido. */
export function OcioLayout() {
  const { pathname } = useLocation();
  const [version, setVersion] = useState(0);
  const [adding, setAdding] = useState(null); // null = cerrado; { type } = abierto
  // Los contadores se refrescan al cambiar de pantalla o cuando algo cambió (versión).
  const countsApi = useApi(api.getOcioCounts, [version, pathname]);
  const genresApi = useApi(api.getOcioGenres, []);

  const c = countsApi.data;
  useSidebarBadges(c ? { all: c.all, movie: c.movie, series: c.series, book: c.book, game: c.game, artworks: c.artworks, outings: c.outings } : {});

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const genres = genresApi.data;
  const value = useMemo(
    () => ({
      version,
      bump,
      genres: genres || {},
      genreLabel: (id) => genres?.[id] ?? String(id).replace(/_/g, " ").replace(/^\w/, (ch) => ch.toUpperCase()),
      openAdd: (type) => setAdding({ type: type || "movie" }),
    }),
    [version, bump, genres]
  );

  return (
    <OcioContext.Provider value={value}>
      <div className="ocio-layout">
        <ModuleTabStrip moduleId="ocio" />
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </div>
      {adding && (
        <AddToLibraryModal
          initialType={adding.type}
          onClose={() => setAdding(null)}
          onSaved={() => bump()}
        />
      )}
    </OcioContext.Provider>
  );
}
