import { useEffect, useRef } from "react";
import { useApi } from "./useApi.js";
import { api } from "../lib/api.js";

/**
 * Estado de KOReader (última importación, pendientes, Dropbox) y, si Dropbox está conectado, una
 * revisión al abrir la pantalla (el server solo va a Dropbox si pasó un rato). Si llegó algo nuevo,
 * llama a `onChanged` para que las pantallas recarguen.
 */
export function useKoreaderSync(onChanged) {
  const statusApi = useApi(() => api.getKoreaderStatus(), []);
  const checked = useRef(false);
  const connected = !!statusApi.data?.dropbox?.connected;

  useEffect(() => {
    if (!connected || checked.current) return;
    checked.current = true;
    let alive = true;
    api
      .syncKoreader({ ifStale: true })
      .then(({ result }) => {
        if (!alive) return;
        if (result?.changed) onChanged?.();
        if (!result?.fresh) statusApi.reload();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return { status: statusApi.data, reload: statusApi.reload };
}
