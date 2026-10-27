import { api } from "./api.js";
import { setCutoffDay, setPeriodClosings, CUTOFF_SETTING_KEY, CLOSINGS_SETTING_KEY } from "./billing.js";

/** Aplica los ajustes que afectan cálculos globales (día de cierre y cierres por mes). Si el server no responde, quedan los defaults. */
export async function applyFinanceSettings() {
  try {
    const settings = await api.getSettings();
    setCutoffDay(settings[CUTOFF_SETTING_KEY]);
    setPeriodClosings(settings[CLOSINGS_SETTING_KEY]);
  } catch {
    /* sin server: default */
  }
}
