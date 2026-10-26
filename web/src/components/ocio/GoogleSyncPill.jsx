import { useEffect, useRef, useState } from "react";
import { CalendarSync, Loader2, RefreshCw, X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { api } from "../../lib/api.js";

const AUTO_SYNC_AFTER_MS = 2 * 60_000;

function ago(iso, now) {
  if (!iso) return "nunca";
  const min = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

/** Pasos para habilitar Google Calendar (las credenciales van en el .env del server). */
function SetupHelp({ status, onClose }) {
  return (
    <Modal onClose={onClose} labelledBy="google-help-title" width="34rem">
      <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 id="google-help-title" className="text-base font-semibold mr-auto">
          Conectar Google Calendar
        </h2>
        <button onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
          <X size={18} />
        </button>
      </div>
      <div className="p-6 text-sm space-y-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        <p>Falta configurar las credenciales de Google en el archivo <code className="font-mono">.env</code> del proyecto (una sola vez):</p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>En Google Cloud, creá un proyecto y habilitá la <b>Google Calendar API</b>.</li>
          <li>
            Pantalla de consentimiento: tipo <b>Externo</b>, agregá tu cuenta y publicala ("En producción") para que el acceso no venza a los 7 días.
          </li>
          <li>
            Credenciales → ID de cliente OAuth → <b>Aplicación web</b>, con este URI de redirección: <code className="font-mono break-all">{status?.redirectUri}</code>
          </li>
          <li>
            Copiá el ID y el secreto en <code className="font-mono">GOOGLE_CLIENT_ID</code> y <code className="font-mono">GOOGLE_CLIENT_SECRET</code>, generá <code className="font-mono">TOKEN_ENCRYPTION_KEY</code> y reiniciá la app.
          </li>
        </ol>
        <p className="text-xs">La guía completa está en el resumen de esta fase y en .env.example.</p>
      </div>
    </Modal>
  );
}

/**
 * Estado de Google Calendar en el encabezado de Salidas: conectar, "sincronizado hace X min" con
 * botón para sincronizar ya, y errores claros (acceso revocado → Reconectar).
 */
export function GoogleSyncPill({ onSynced }) {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const [now, setNow] = useState(Date.now());
  const autoDone = useRef(false);

  async function sync() {
    setSyncing(true);
    try {
      const r = await api.syncGoogle();
      setStatus(r.status);
      onSynced?.();
    } catch {
      setStatus(await api.getGoogleStatus().catch(() => status));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    api
      .getGoogleStatus()
      .then((s) => {
        setStatus(s);
        // Al abrir Salidas, si hace rato que no se sincroniza, se sincroniza solo.
        if (!autoDone.current && s.connected && (!s.lastSyncAt || Date.now() - new Date(s.lastSyncAt).getTime() > AUTO_SYNC_AFTER_MS)) {
          autoDone.current = true;
          sync();
        }
      })
      .catch(() => setStatus(null));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!status) return null;
  const pill = "flex items-center gap-2 h-10 pl-3 pr-1.5 rounded-xl text-sm";
  const border = { border: "1px solid var(--border)" };

  if (!status.configured || (!status.connected && !status.needsReconnect)) {
    return (
      <>
        <button
          onClick={() => (status.configured ? (window.location.href = api.googleAuthUrl) : setHelp(true))}
          className="hover-surface flex items-center gap-2 h-10 px-3 text-sm font-medium"
          style={border}
        >
          <CalendarSync size={15} style={{ color: "var(--accent)" }} />
          Conectar Google Calendar
        </button>
        {help && <SetupHelp status={status} onClose={() => setHelp(false)} />}
      </>
    );
  }

  if (status.needsReconnect) {
    return (
      <button onClick={() => (window.location.href = api.googleAuthUrl)} className={`${pill} pr-3 font-medium`} style={{ border: "1px solid color-mix(in srgb, var(--status-warning) 45%, var(--border))" }} title={status.lastError || ""}>
        <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: "var(--status-warning)" }} />
        Google Calendar · <b style={{ color: "var(--status-warning)" }}>Reconectar</b>
      </button>
    );
  }

  const failed = status.status === "error";
  return (
    <div className="relative">
      <div className={pill} style={border}>
        <span className="inline-block rounded-full shrink-0" style={{ width: 7, height: 7, background: failed ? "var(--status-critical)" : "var(--status-good)" }} />
        <button onClick={() => setMenu((v) => !v)} className="flex items-baseline gap-1.5 min-w-0" title={failed ? status.lastError : status.email ?? ""} aria-expanded={menu}>
          <span className="font-semibold whitespace-nowrap">Google Calendar</span>
          <span className="text-xs whitespace-nowrap hidden sm:inline" style={{ color: failed ? "var(--status-critical)" : "var(--text-faint)" }}>
            {syncing ? "sincronizando…" : failed ? "error al sincronizar" : `sincronizado ${ago(status.lastSyncAt, now)}`}
          </span>
        </button>
        <button onClick={sync} disabled={syncing} aria-label="Sincronizar ahora" title="Sincronizar ahora" className="hover-surface w-7 h-7 flex items-center justify-center shrink-0" style={{ color: "var(--text-muted)" }}>
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>
      {menu && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-64 rounded-xl p-3 text-xs space-y-2" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
          <p style={{ color: "var(--text-muted)" }}>
            Calendario <b style={{ color: "var(--text)" }}>{status.calendarName || "Salidas"}</b>
            {status.email && <> de {status.email}</>}. Lo que creás acá también se copia allá.
          </p>
          {failed && <p style={{ color: "var(--status-critical)" }}>{status.lastError}</p>}
          <button
            onClick={async () => {
              if (!window.confirm("¿Desconectar Google Calendar? Las salidas quedan acá; el calendario en Google no se borra.")) return;
              setStatus(await api.disconnectGoogle());
              setMenu(false);
            }}
            className="hover-surface w-full text-left h-8 px-2"
            style={{ color: "var(--danger)" }}
          >
            Desconectar
          </button>
        </div>
      )}
    </div>
  );
}
