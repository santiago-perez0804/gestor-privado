import { Popcorn } from "lucide-react";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { formatShortDate, todayDateInputValue } from "../../lib/format.js";
import { WORK_TYPES, progressText } from "../../lib/ocio/types.js";
import { PanelShell, Row } from "./PanelShell.jsx";

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

export function OcioPanel({ onClose, onBack }) {
  const { data, loading, error } = useApi(() => Promise.all([api.getOutings(), api.getLibrary({ status: "in_progress" })]), []);

  let body = null;
  if (data) {
    const [outings, media] = data;
    const today = todayDateInputValue();
    const upcoming = outings
      .filter((o) => o.date >= today && (o.status === "confirmed" || o.status === "tentative"))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
    const inProgress = media.slice(0, 4);

    body = (
      <>
        <div className="flex flex-col gap-1.5">
          <SubHeading>Próximas salidas</SubHeading>
          {upcoming.length === 0 ? (
            <Muted>Nada planeado. ¿Organizamos algo?</Muted>
          ) : (
            upcoming.map((o) => (
              <Row key={o.id} right={o.date === today ? "hoy" : formatShortDate(o.date)}>
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
              <Row key={m.id} right={progressText(m.currentPass?.progress, m.type) ?? WORK_TYPES[m.type].label}>
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
