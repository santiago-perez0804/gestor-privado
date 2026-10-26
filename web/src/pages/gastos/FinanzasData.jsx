import { createContext, useContext } from "react";

/**
 * Gastos cargados una sola vez por el layout de Finanzas y compartidos con el Resumen y la barra
 * lateral (badge de cuotas). `{ expenses, setExpenses, reload }`.
 */
export const FinanzasDataContext = createContext(null);

export function useFinanzasData() {
  return useContext(FinanzasDataContext);
}
