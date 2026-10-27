import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reordenar arrastrando con el dedo o el mouse (pointer events: el drag & drop HTML5 no funciona con
 * el dedo en iOS). Mientras arrastrás, la lista se reacomoda; al soltar se llama `onCommit` con el
 * orden nuevo si cambió. Para accesibilidad, conviene ofrecer además botones subir/bajar.
 * @param {(string|number)[]} ids
 * @param {(ids: (string|number)[]) => void} onCommit
 */
export function useSortable(ids, onCommit) {
  const key = ids.join(",");
  const [order, setOrder] = useState(ids);
  const [dragging, setDragging] = useState(null);
  const orderRef = useRef(order);
  const rows = useRef(new Map());

  useEffect(() => {
    setOrder(ids);
    orderRef.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const rowRef = useCallback(
    (id) => (el) => {
      if (el) rows.current.set(id, el);
      else rows.current.delete(id);
    },
    []
  );

  const handleProps = (id) => ({
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragging(id);
    },
    onPointerMove: (e) => {
      if (dragging !== id) return;
      const current = orderRef.current;
      const others = current.filter((x) => x !== id);
      // Cuántas filas quedan arriba del dedo (por su mitad) = el nuevo lugar.
      let target = 0;
      for (const other of others) {
        const rect = rows.current.get(other)?.getBoundingClientRect();
        if (rect && e.clientY > rect.top + rect.height / 2) target += 1;
      }
      const next = [...others.slice(0, target), id, ...others.slice(target)];
      if (next.join(",") !== current.join(",")) {
        orderRef.current = next;
        setOrder(next);
      }
    },
    onPointerUp: () => {
      if (dragging !== id) return;
      setDragging(null);
      if (orderRef.current.join(",") !== key) onCommit(orderRef.current);
    },
    onPointerCancel: () => {
      setDragging(null);
      orderRef.current = ids;
      setOrder(ids);
    },
    style: { touchAction: "none", cursor: dragging === id ? "grabbing" : "grab" },
    "aria-label": "Arrastrar para reordenar",
  });

  return { order, dragging, handleProps, rowRef };
}

/** Mueve un id una posición (para los botones subir/bajar). */
export function moveId(ids, id, delta) {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
