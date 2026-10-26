import { createContext, useContext } from "react";

/**
 * Lo que comparten las pantallas de Ocio:
 * - `openAdd(type?)` abre "Agregar a la biblioteca" (desde Inicio, Biblioteca, etc.).
 * - `version` cambia cada vez que se agrega o modifica algo: las pantallas lo usan para recargar.
 * - `bump()` avisa que algo cambió (recarga contadores y pantallas).
 * - `genreLabel(id)` nombre en español de un género.
 */
export const OcioContext = createContext(null);
export const useOcio = () => useContext(OcioContext);
