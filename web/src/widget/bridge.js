// Puente con el proceso main de Electron (desktop/preload.js). Si el widget se abre
// en un navegador común (para desarrollar), todo degrada a algo razonable.
const native = typeof window !== "undefined" ? window.frogBridge : undefined;
const noop = () => () => {};

export const isDesktop = !!native;

export function init() {
  if (native) return native.init();
  const bounds = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  return Promise.resolve({ displayId: 0, bounds, displays: [{ id: 0, index: 1, workArea: bounds }], isOwner: true, prefs: {} });
}

let lastClickThrough = null;

export function setClickThrough(ignore) {
  if (lastClickThrough === ignore) return;
  lastClickThrough = ignore;
  native?.setClickThrough(ignore);
}

export const transfer = (payload) => (native ? native.transfer(payload) : Promise.resolve(false));
export const yankStart = () => (native ? native.yankStart() : Promise.resolve(false));
export const cursorTo = (p) => native?.cursorTo(p);
export const releaseFocus = () => native?.releaseFocus();
export const openSettings = () => native?.openSettings?.();

/** Zonas interactivas del sapo ([x, y, ancho, alto] del overlay): solo cerca de ellas se reenvía el mouse. */
export const setHitZones = (zones) => native?.setHitZones?.(zones);

export function openApp(route) {
  if (native) native.openApp(route);
  else window.open(route, "_blank");
}

export const onPrefs = native?.onPrefs ?? noop;
export const onOwner = native?.onOwner ?? noop;
export const onArrive = native?.onArrive ?? noop;
export const onHotkey = native?.onHotkey ?? noop;
export const onPause = native?.onPause ?? noop;
/** Posición del cursor que manda el main (también cuando el overlay no recibe eventos del mouse). */
export const onCursor = native?.onCursor ?? noop;
