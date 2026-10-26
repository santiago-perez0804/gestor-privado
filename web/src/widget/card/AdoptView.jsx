import { useState } from "react";
import { Heart } from "lucide-react";
import { FrogAvatar } from "../Frog.jsx";
import { SPECIES, loadHistory } from "../pet.js";
import { PrimaryButton, ViewHeader, inputStyle } from "./ui.jsx";

/** Adopción: primera vez, después de que la mascota anterior murió, o para cambiarla a mano. */
export function AdoptView({ ctl }) {
  const { pet } = ctl;
  const dead = !pet.alive;
  // Con una mascota viva se llega acá desde "Cambiar mascota": se reemplaza y arranca en nivel 1.
  const switching = pet.alive && pet.adopted;
  const otherSpecies = Object.keys(SPECIES).find((s) => s !== pet.species) || "sapo";
  const [species, setSpecies] = useState(dead ? "sapo" : switching ? otherSpecies : pet.species || "sapo");
  const [name, setName] = useState("");
  const history = loadHistory();

  function choose(s) {
    setSpecies(s);
    ctl.previewSpecies(s);
  }

  return (
    <div className="flex flex-col gap-3">
      {switching ? (
        <div>
          <ViewHeader title="Cambiar de mascota" onBack={() => ctl.setView("home")} />
          <div className="rounded-xl p-3 text-[11px]" style={{ background: "rgba(245, 158, 11, 0.16)", color: "#b7770a" }}>
            {pet.name} (nivel {pet.level}) se va y la nueva empieza en nivel 1, sin accesorios. Tus datos del gestor no se tocan.
          </div>
        </div>
      ) : dead ? (
        <div className="rounded-xl p-3 text-center" style={{ background: "var(--surface-alt)" }}>
          <p className="text-sm font-semibold">{pet.name} ya no está 🕊️</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Llegó a nivel {pet.level}. Tus gastos, entrenos y todo lo del gestor siguen intactos: solo empieza una mascota nueva.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-[15px] font-semibold">¡Adoptá tu mascota!</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Te acompaña en el escritorio y crece con vos. Si la descuidás muchos días, se muere.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {Object.entries(SPECIES).map(([id, s]) => (
          <button
            key={id}
            onClick={() => choose(id)}
            className="rounded-xl py-3 flex flex-col items-center gap-1.5"
            style={{
              background: species === id ? "var(--accent-soft)" : "var(--surface-alt)",
              outline: species === id ? "2px solid var(--accent)" : "none",
            }}
            aria-pressed={species === id}
          >
            <FrogAvatar size={52} species={id} />
            <span className="text-xs font-semibold">{s.label}</span>
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ctl.adopt({ species, name: name.trim().slice(0, 18) || SPECIES[species].defaultName });
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nombre (ej. ${SPECIES[species].defaultName})`}
          maxLength={18}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        />
        <PrimaryButton type="submit">
          <Heart size={15} />
          Adoptar {SPECIES[species].label.toLowerCase()}
        </PrimaryButton>
      </form>

      {history.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>
            Recuerdos
          </p>
          <div className="flex flex-col gap-1">
            {history.slice(0, 5).map((h) => (
              <div key={h.diedAt} className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                <FrogAvatar size={20} species={h.species} ghost />
                <span className="flex-1 truncate">{h.name}</span>
                <span className="font-mono">
                  nv {h.level} · {h.days} {h.days === 1 ? "día" : "días"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
