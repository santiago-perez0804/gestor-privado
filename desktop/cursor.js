// Acceso mínimo a user32 para que el sapo pueda "tirar" del mouse con la lengua.
// koffi trae binarios precompilados, así que no hace falta compilar nada.
const { screen } = require("electron");

let SetCursorPos = null;
let GetAsyncKeyState = null;

try {
  const koffi = require("koffi");
  const user32 = koffi.load("user32.dll");
  SetCursorPos = user32.func("bool __stdcall SetCursorPos(int x, int y)");
  GetAsyncKeyState = user32.func("short __stdcall GetAsyncKeyState(int vKey)");
} catch (err) {
  console.warn("[desktop] koffi no disponible, la lengua no va a mover el mouse:", err.message);
}

const VK_LBUTTON = 0x01;
const VK_RBUTTON = 0x02;
const VK_MBUTTON = 0x04;

function isAnyMouseButtonDown() {
  if (!GetAsyncKeyState) return true;
  return [VK_LBUTTON, VK_RBUTTON, VK_MBUTTON].some((vk) => (GetAsyncKeyState(vk) & 0x8000) !== 0);
}

/** Se puede tironear del cursor solo si existe la API y el usuario no está apretando nada. */
function canYank() {
  return !!SetCursorPos && !isAnyMouseButtonDown();
}

/** Ubica el cursor en un punto de pantalla en coordenadas DIP (las de Electron). */
function setCursor(p) {
  if (!SetCursorPos) return;
  const physical = process.platform === "win32" ? screen.dipToScreenPoint(p) : p;
  SetCursorPos(Math.round(physical.x), Math.round(physical.y));
}

module.exports = { canYank, setCursor, available: () => !!SetCursorPos };
