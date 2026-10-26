import { Popcorn } from "lucide-react";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { formatShortDate, todayDateInputValue } from "../../lib/format.js";
import { PanelShell, Row } from "./PanelShell.jsx";

const TYPE_LABEL = { pelicula: "Película", serie: "Serie", libro: "Libro", videojuego: "Juego" };

function SubHeading({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
      {children}
    </p>
  );
}

function Muted({ children }) {
  return (
    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

function progressText(m) {
  if (m.progressCurrent == null) return TYPE_LABEL[m.type];
  const label = m.progressLabel ? `${m.progressLabel} ` : "";
  const total = m.progressTotal ? `/${m.progressTotal}` : "";
  return `${label}${m.progressCurrent}${total}`;
}

export function OcioPanel({ onClose, onBack }) {
  const { data, loading, error } = useApi(() => Promise.all([api.getOutings(), api.getMediaItems()]), []);

  let body = null;
  if (data) {
    const [outings, media] = data;
    const today = todayDateInputValue();
    const upcoming = outings
      .filter((o) => o.plannedDate >= today && o.status === "planeado")
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
      .slice(0, 3);
    const inProgress = media.filter((m) => m.status === "en_progreso").slice(0, 4);

    body = (
      <>
        <div className="flex flex-col gap-1.5">
          <SubHeading>Próximas salidas</SubHeading>
          {upcoming.length === 0 ? (
            <Muted>Nada planeado. ¿Organizamos algo?</Muted>
          ) : (
            upcoming.map((o) => (
              <Row key={o.id} right={o.plannedDate === today ? "hoy" : formatShortDate(o.plannedDate)}>
                {o.title}
              </Row>
            ))
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <SubHeading>En curso</SubHeading>
          {inProgress.length === 0 ? (
            <Muted>No estás viendo, leyendo ni jugando nada.</Muted>
          ) : (
            inProgress.map((m) => (
              <Row key={m.id} right={progressText(m)}>
                {m.title}
              </Row>
            ))
          )}
        </div>
      </>
    );
  }

  return (
    <PanelShell title="Ocio" icon={Popcorn} route="/ocio" onClose={onClose} onBack={onBack} loading={loading} error={error}>
      {body}
    </PanelShell>
  );
}
