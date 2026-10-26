import { Bed, Sun } from "lucide-react";
import { ViewHeader, PrimaryButton } from "./ui.jsx";

const OPTIONS = [
  { minutes: 30, label: "30 minutos" },
  { minutes: 60, label: "1 hora" },
  { minutes: 120, label: "2 horas" },
  { minutes: null, label: "Hasta que lo despierte" },
];

function untilText(until) {
  if (!until) return "hasta que lo despiertes";
  const d = new Date(until);
  return `hasta las ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function SleepView({ ctl }) {
  const { pet } = ctl;
  return (
    <div>
      <ViewHeader title="Modo no molestar" onBack={() => ctl.setView("home")} />
      {pet.dnd ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {pet.name} está durmiendo {untilText(pet.dnd.until)}. Recupera energía mientras tanto.
          </p>
          <PrimaryButton onClick={ctl.wake}>
            <Sun size={15} />
            Despertar
          </PrimaryButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            Se va a una esquina a dormir: no muestra avisos, no caza moscas ni te agarra el mouse. Los recordatorios quedan guardados para
            cuando se despierte.
          </p>
          {OPTIONS.map((o) => (
            <button
              key={o.label}
              onClick={() => ctl.sleep(o.minutes)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-colors"
              style={{ background: "var(--surface-alt)" }}
            >
              <Bed size={15} style={{ color: "#6d7cff" }} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
