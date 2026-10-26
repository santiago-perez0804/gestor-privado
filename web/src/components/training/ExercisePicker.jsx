import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { inputClass } from "../common/FieldLabel.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { getIconComponent, pickExerciseIcon } from "../../lib/icons.js";
import { api } from "../../lib/api.js";

const MUSCLES = [
  "abdominals", "abductors", "adductors", "biceps", "calves", "chest", "forearms", "glutes",
  "hamstrings", "lats", "lower back", "middle back", "neck", "quadriceps", "shoulders", "traps", "triceps",
];

const EQUIPMENT = [
  "barbell", "dumbbell", "machine", "cable", "body only", "kettlebells",
  "bands", "exercise ball", "foam roll", "medicine ball", "e-z curl bar", "other",
];

export function ExercisePicker({ onSelect, onClose }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [results, setResults] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      api.searchExerciseLibrary({ q, muscle, equipment }).then(setResults);
    }, 200);
    return () => clearTimeout(timeout);
  }, [q, muscle, equipment]);

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Buscar ejercicio
        </p>
        <button onClick={onClose} aria-label="Cerrar" style={{ color: "var(--text-faint)" }}>
          <X size={15} />
        </button>
      </div>
      <div className="flex gap-2 mb-2">
        <div className="relative" style={{ flex: 1 }}>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre..."
            className={inputClass()}
            style={{ paddingLeft: 28 }}
          />
        </div>
      </div>
      <div className="flex gap-2 mb-3">
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)} className={inputClass()} style={{ flex: 1 }}>
          <option value="">Todos los músculos</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)} className={inputClass()} style={{ flex: 1 }}>
          <option value="">Todo el equipo</option>
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </select>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {!results ? (
          <p className="text-xs px-3 py-3" style={{ color: "var(--text-faint)" }}>
            Buscando...
          </p>
        ) : results.length === 0 ? (
          <div className="py-3">
            <EmptyState>Sin resultados para este filtro.</EmptyState>
          </div>
        ) : (
          results.map((ex) => {
            const Icon = getIconComponent(pickExerciseIcon(ex.primaryMuscles));
            return (
              <button
                key={ex.id}
                onClick={() => onSelect(ex)}
                className="flex items-center gap-2.5 w-full text-left px-3 py-2"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <Icon size={14} style={{ color: "var(--accent)" }} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm truncate">{ex.name}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
                    {ex.primaryMuscles.join(", ")} {ex.equipment ? `· ${ex.equipment}` : ""}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
