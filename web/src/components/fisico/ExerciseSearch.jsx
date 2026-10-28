import { useEffect, useRef, useState } from "react";
import { Globe2, Loader2, Plus, Search } from "lucide-react";
import { api } from "../../lib/api.js";
import { MUSCLE_IDS } from "../../lib/fisico/index.js";
import { equipmentLabel, muscleLabel, musclesText } from "../../lib/fisico/labels.js";
import { ExerciseFormModal } from "./ExerciseFormModal.jsx";

/**
 * Buscador de la biblioteca: la propia en español (con filtro por músculo), la grande en inglés
 * (se importa con los músculos ya traducidos) y el alta de un ejercicio propio.
 * `onPick(exercise)` recibe el ejercicio elegido (ya existente en la biblioteca propia).
 */
export function ExerciseSearch({ onPick, muscle: initialMuscle = "", placeholder = "Buscar en la biblioteca: «face pull», «bíceps», «polea»…", autoFocus = false, dropUp = false }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState(initialMuscle);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [legacy, setLegacy] = useState(null); // null = sin buscar; [] = sin resultados
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => setMuscle(initialMuscle), [initialMuscle]);
  useEffect(() => {
    if (initialMuscle) setOpen(true);
  }, [initialMuscle]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      api
        .getExercises({ q, muscle })
        .then((list) => alive && setResults(list.slice(0, 30)))
        .catch(() => {});
    }, 150);
    setLegacy(null);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, muscle]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  async function searchLegacy() {
    setBusy(true);
    try {
      setLegacy(await api.searchLegacyExercises({ q, muscle }));
    } finally {
      setBusy(false);
    }
  }

  async function importLegacy(item) {
    setBusy(true);
    try {
      pick(await api.importLegacyExercise(item.libraryId));
    } finally {
      setBusy(false);
    }
  }

  function pick(exercise) {
    onPick(exercise);
    setQ("");
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex gap-2">
        <label className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} />
          <input value={q} autoFocus={autoFocus} onChange={(e) => (setQ(e.target.value), setOpen(true))} onFocus={() => setOpen(true)} placeholder={placeholder} aria-label="Buscar ejercicio" className="w-full h-11 rounded-lg pl-9 pr-3 text-sm" />
        </label>
        <select value={muscle} onChange={(e) => (setMuscle(e.target.value), setOpen(true))} aria-label="Filtrar por músculo" className="h-11 rounded-lg px-2 text-sm w-36 shrink-0">
          <option value="">Todos</option>
          {MUSCLE_IDS.map((m) => (
            <option key={m} value={m}>
              {muscleLabel(m)}
            </option>
          ))}
        </select>
      </div>
      {open && (
        <div className={`absolute left-0 right-0 z-30 rounded-xl overflow-hidden top-12 ${dropUp ? "fit:top-auto fit:bottom-12" : ""}`} style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 20px 50px -20px rgba(0,0,0,.6)" }}>
          <ul className="thin-scroll max-h-72 overflow-y-auto" role="listbox" aria-label="Ejercicios">
            {results.map((e) => (
              <li key={e.id}>
                <button onClick={() => pick(e)} className="hover-surface w-full text-left px-4 py-2.5 flex items-center gap-3" style={{ borderRadius: 0 }}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{e.name}</span>
                    <span className="block text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                      {musclesText(e.muscles)} · {equipmentLabel(e.equipment)}
                      {e.isCustom ? " · propio" : ""}
                    </span>
                  </span>
                  <Plus size={15} style={{ color: "var(--accent)" }} />
                </button>
              </li>
            ))}
            {!results.length && (
              <li className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                No hay ejercicios con eso en tu biblioteca.
              </li>
            )}
            {legacy?.map((e) => (
              <li key={e.libraryId}>
                <button onClick={() => importLegacy(e)} disabled={busy} className="hover-surface w-full text-left px-4 py-2.5 flex items-center gap-3" style={{ borderRadius: 0 }}>
                  <Globe2 size={14} style={{ color: "var(--text-faint)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm truncate">{e.name}</span>
                    <span className="block text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                      {musclesText(e.muscles)} · {equipmentLabel(e.equipment)} {e.imported && "· ya importado"}
                    </span>
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--accent-strong)" }}>
                    {e.imported ? "Agregar" : "Importar"}
                  </span>
                </button>
              </li>
            ))}
            {legacy && !legacy.length && (
              <li className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                Tampoco en la biblioteca grande. Creá el tuyo.
              </li>
            )}
          </ul>
          <div className="flex flex-wrap gap-2 px-3 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
            {legacy == null && (q.trim().length >= 3 || muscle) && (
              <button onClick={searchLegacy} disabled={busy} className="hover-surface flex items-center gap-1.5 h-9 px-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Globe2 size={13} />}
                Buscar en la biblioteca grande (inglés)
              </button>
            )}
            <button onClick={() => setCreating(true)} className="hover-surface flex items-center gap-1.5 h-9 px-3 text-xs font-semibold ml-auto" style={{ color: "var(--accent-strong)" }}>
              <Plus size={13} />
              Crear ejercicio propio
            </button>
          </div>
        </div>
      )}
      {creating && <ExerciseFormModal initial={{ name: q, muscles: muscle ? [{ muscle, role: "primary" }] : [] }} onClose={() => setCreating(false)} onSaved={pick} />}
    </div>
  );
}
