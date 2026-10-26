// Accesorios que se desbloquean al subir de nivel. La lista la define el usuario: cada uno tiene
// un `slot` (un solo accesorio por lugar a la vez) y su dibujo vive en Frog.jsx (AccessoryArt),
// en el mismo sistema de coordenadas (viewBox 0 0 120 110) para sapo y zorro.
//
// Formato:
//   { id: "gorra", name: "Gorra", level: 3, slot: "cabeza" }
//
// Slots sugeridos: "cabeza", "cara", "cuello", "mano", "espalda".
export const ACCESSORIES = [];

/** Próximo accesorio por desbloquear (o null). */
export function nextUnlock(level) {
  return ACCESSORIES.filter((a) => a.level > level).sort((a, b) => a.level - b.level)[0] ?? null;
}
