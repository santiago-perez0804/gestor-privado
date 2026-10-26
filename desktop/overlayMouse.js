// Cómo recibe el mouse cada overlay del sapo.
//
// El overlay es una ventana transparente que cubre todo el monitor. Con
// setIgnoreMouseEvents(true, { forward: true }) se entera de cada movimiento del mouse, pero en
// Windows eso hace que el cursor y el "hover" de la ventana de abajo (el gestor o cualquier app)
// parpadeen. Por eso solo se reenvía cuando el cursor está cerca del sapo o de algo suyo; el resto
// del tiempo el main le pasa la posición del cursor por IPC (para que el sapo lo siga con la mirada).

/** Margen alrededor de las zonas del sapo dentro del cual se reenvían los eventos (px DIP). */
const NEAR_MARGIN = 60;

/**
 * - "capture": el sapo recibe clics (el mouse está sobre él o se lo está arrastrando).
 * - "forward": deja pasar los clics pero recibe el movimiento (cerca del sapo).
 * - "ignore": totalmente transparente al mouse (lejos del sapo: sin parpadeo).
 */
function mouseMode({ clickThrough, near }) {
  if (!clickThrough) return "capture";
  return near ? "forward" : "ignore";
}

/** ¿El punto (coordenadas del overlay) está cerca de alguna zona [x, y, ancho, alto]? */
function isNear(point, zones, margin = NEAR_MARGIN) {
  return zones.some(
    ([x, y, w, h]) => point.x >= x - margin && point.x <= x + w + margin && point.y >= y - margin && point.y <= y + h + margin
  );
}

/** Aplica el modo a la ventana (solo si cambió: setIgnoreMouseEvents no es gratis). */
function applyMouseMode(win, state) {
  const mode = mouseMode(state);
  if (mode === state.applied || win.isDestroyed()) return;
  state.applied = mode;
  if (mode === "capture") win.setIgnoreMouseEvents(false);
  else if (mode === "forward") win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(true);
}

module.exports = { NEAR_MARGIN, mouseMode, isNear, applyMouseMode };
