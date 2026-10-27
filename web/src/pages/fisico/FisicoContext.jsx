import { createContext, useContext } from "react";

/**
 * Lo que comparten las pantallas de Físico:
 * - `version` cambia cuando algo se modifica (las pantallas recargan); `bump()` avisa el cambio.
 * - `settings`: ajustes efectivos de Físico (rango de volumen, pasos, discos, zona horaria…).
 */
export const FisicoContext = createContext(null);
export const useFisico = () => useContext(FisicoContext);
