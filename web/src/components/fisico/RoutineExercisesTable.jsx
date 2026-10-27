import { ArrowDown, ArrowUp, GripVertical, Pencil, Trash2 } from "lucide-react";
import { lastText, musclesText, nextText, prescriptionText, restText, rirText } from "../../lib/fisico/labels.js";
import { ActionsMenu } from "./bits.jsx";
import { moveId, useSortable } from "./useSortable.js";

const TONE = { up: "var(--accent-strong)", down: "var(--status-warning)", same: "var(--text)", none: "var(--text-faint)" };

/**
 * Ejercicios de la rutina: arrastrar para reordenar (o subir/bajar desde el menú), prescripción,
 * lo de la última vez y la sugerencia para la próxima. En el celular, cada uno es una tarjeta.
 */
export function RoutineExercisesTable({ items, onReorder, onEdit, onRemove }) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const { order, dragging, handleProps, rowRef } = useSortable(
    items.map((i) => i.id),
    onReorder
  );
  const rows = order.map((id) => byId.get(id)).filter(Boolean);

  if (!rows.length)
    return (
      <p className="text-sm rounded-xl px-4 py-6 text-center" style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
        Todavía no tiene ejercicios. Buscalos abajo y se agregan con 3 × 8–12.
      </p>
    );

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="hidden md:grid grid-cols-[2.25rem_minmax(0,1fr)_5.5rem_4rem_4.5rem_minmax(0,9rem)_minmax(0,7.5rem)_2.5rem] gap-3 px-3 py-2.5 text-[11px]" style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border)" }}>
        <span />
        <span>Ejercicio</span>
        <span>Series × reps</span>
        <span>Descanso</span>
        <span>Esfuerzo</span>
        <span>Última vez</span>
        <span>Próxima</span>
        <span />
      </div>
      <ol>
        {rows.map((it, i) => {
          const next = nextText(it.next, it.exercise);
          return (
            <li
              key={it.id}
              ref={rowRef(it.id)}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.5rem] md:grid-cols-[2.25rem_minmax(0,1fr)_5.5rem_4rem_4.5rem_minmax(0,9rem)_minmax(0,7.5rem)_2.5rem] gap-x-3 gap-y-1 items-center px-3 py-3"
              style={{ borderTop: i ? "1px solid var(--border)" : undefined, background: dragging === it.id ? "var(--surface-alt)" : undefined }}
            >
              <span {...handleProps(it.id)} className="flex items-center gap-0.5 font-mono text-xs select-none h-10" style={{ ...handleProps(it.id).style, color: "var(--text-faint)" }}>
                <GripVertical size={14} />
                {i + 1}
              </span>
              <button onClick={() => onEdit(it)} className="text-left min-w-0">
                <span className="block text-sm font-semibold truncate">
                  {it.supersetGroup && (
                    <span className="mr-1.5 text-[10px] font-mono rounded px-1" style={{ background: "var(--surface-alt)" }}>
                      {it.supersetGroup}
                    </span>
                  )}
                  {it.exercise?.name}
                </span>
                <span className="block text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                  {musclesText(it.exercise?.muscles)}
                </span>
                {/* En el celular, la prescripción y la próxima van debajo del nombre. */}
                <span className="md:hidden flex flex-wrap gap-x-3 text-xs mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
                  <span>{prescriptionText(it)}</span>
                  <span>{restText(it.restSeconds)}</span>
                  {rirText(it.rirMin, it.rirMax) && <span>{rirText(it.rirMin, it.rirMax)}</span>}
                  <span style={{ color: TONE[next.tone] }}>→ {next.text}</span>
                </span>
              </button>
              <span className="hidden md:block font-mono text-sm">{prescriptionText(it)}</span>
              <span className="hidden md:block font-mono text-sm" style={{ color: "var(--text-muted)" }}>
                {restText(it.restSeconds)}
              </span>
              <span className="hidden md:block text-xs" style={{ color: "var(--text-muted)" }}>
                {rirText(it.rirMin, it.rirMax) || "—"}
              </span>
              <span className="hidden md:block font-mono text-xs truncate" style={{ color: "var(--text-faint)" }} title={lastText(it.last, it.exercise)}>
                {lastText(it.last, it.exercise)}
              </span>
              <span className="hidden md:block font-mono text-xs font-semibold truncate" style={{ color: TONE[next.tone] }}>
                {next.text}
              </span>
              <ActionsMenu
                label={`Acciones de ${it.exercise?.name}`}
                items={[
                  { label: "Editar", icon: Pencil, onClick: () => onEdit(it) },
                  { label: "Subir", icon: ArrowUp, disabled: i === 0, onClick: () => onReorder(moveId(order, it.id, -1)) },
                  { label: "Bajar", icon: ArrowDown, disabled: i === rows.length - 1, onClick: () => onReorder(moveId(order, it.id, 1)) },
                  { label: "Quitar", icon: Trash2, danger: true, onClick: () => onRemove(it) },
                ]}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
