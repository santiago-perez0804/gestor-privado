import { api } from "./api.js";
import { setCutoffDay, CUTOFF_SETTING_KEY } from "./billing.js";

/** Aplica los ajustes que afectan cálculos globales (día de cierre). Si el server no responde, quedan los defaults. */
export async function applyFinanceSettings() {
  try {
    const settings = await api.getSettings();
    setCutoffDay(settings[CUTOFF_SETTING_KEY]);
  } catch {
    /* sin server: default */
  }
}
