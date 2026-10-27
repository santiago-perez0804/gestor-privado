import { useState } from "react";
import { AlertCircle, Cloud, Loader2, RefreshCw } from "lucide-react";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 días". */
export function ago(iso) {
  if (!iso) return null;
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

function KindleGuide() {
  return (
    <details className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
      <summary className="cursor-pointer font-semibold py-1" style={{ color: "var(--text)" }}>
        Cómo configurar el Kindle
      </summary>
      <ol className="list-decimal pl-5 space-y-1.5 mt-1.5">
        <li>
          En KOReader: <b>Herramientas → Almacenamiento en la nube → Agregar → Dropbox</b>, con la misma app de Dropbox que usa este gestor (los datos que pida tu versión de KOReader).
        </li>
        <li>
          <b>Estadísticas de lectura → Ajustes → Sincronización en la nube</b>: elegí ese Dropbox y la carpeta (la raíz de la app, salvo que cambies la ruta acá abajo). Después <b>Sincronizar ahora</b> una vez.
        </li>
        <li>
          Para que sea automático: <b>Herramientas → Perfiles</b> → un perfil con «Activar Wi-Fi» y «Reading statistics: synchronize», y en «Ejecutar automáticamente» elegí al cerrar el libro (o al suspender).
        </li>
        <li>Listo: este gestor revisa Dropbox cada 15 minutos y al abrir Estadísticas o tus libros. Si no cambió nada, no baja nada.</li>
      </ol>
    </details>
  );
}

/** Sincronización automática de KOReader por Dropbox: estado, conectar, ruta y "sincronizar ahora". */
export function KoreaderSyncPanel({ onSynced, onOpenPending }) {
  const statusApi = useApi(() => api.getDropboxStatus(), []);
  const s = statusApi.data;
  const [busy, setBusy] = useState(null); // "sync" | "path" | "off"
  const [message, setMessage] = useState(null);
  const [editingPath, setEditingPath] = useState(null);

  async function run(kind, fn) {
    setBusy(kind);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(null);
      statusApi.reload();
    }
  }

  const syncNow = () =>
    run("sync", async () => {
      const { result } = await api.syncKoreader({ force: false });
      if (result.changed) {
        setMessage(`Listo: ${result.sessionsNew} sesiones nuevas${result.pending ? `, ${result.pending} ${result.pending === 1 ? "libro" : "libros"} para confirmar` : ""}.`);
        onSynced?.();
      } else setMessage(result.missing ? null : "No había nada nuevo en Dropbox.");
    });

  const box = "rounded-xl p-4 space-y-3";
  if (!s) return <div className={box} style={{ border: "1px solid var(--border)", minHeight: 96 }} aria-busy="true" />;

  return (
    <section className={box} style={{ border: "1px solid var(--border)", background: "var(--surface-alt)" }} aria-label="Sincronización automática">
      <div className="flex items-start gap-3">
        <Cloud size={18} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Sincronización automática (Dropbox)</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {!s.configured
              ? "Falta configurar la app de Dropbox en el .env."
              : !s.connected
                ? s.needsReconnect
                  ? "Dropbox revocó el acceso: volvé a conectar."
                  : "El Kindle sube sus estadísticas a Dropbox y acá se importan solas."
                : `Conectado${s.email ? ` como ${s.email}` : ""} · ${s.lastSyncAt ? `última importación ${ago(s.lastSyncAt)}` : "todavía sin importar"}${s.lastCheckAt ? ` · revisado ${ago(s.lastCheckAt)}` : ""}`}
          </p>
        </div>
      </div>

      {!s.configured && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Creá una app en <b>dropbox.com/developers/apps</b> (Scoped access → App folder; permisos <code className="font-mono">files.metadata.read</code>, <code className="font-mono">files.content.read</code>, <code className="font-mono">files.content.write</code>; redirect URI <code className="font-mono break-all">{s.redirectUri}</code>) y poné <code className="font-mono">DROPBOX_APP_KEY</code>, <code className="font-mono">DROPBOX_APP_SECRET</code> y <code className="font-mono">TOKEN_ENCRYPTION_KEY</code> en el .env. Después reiniciá la app.
        </p>
      )}

      {s.configured && !s.connected && (
        <a href={api.dropboxAuthUrl} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Cloud size={15} />
          {s.needsReconnect ? "Reconectar Dropbox" : "Conectar Dropbox"}
        </a>
      )}

      {s.connected && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span style={{ color: "var(--text-muted)" }}>Archivo en Dropbox:</span>
            {editingPath != null ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run("path", async () => {
                    await api.setKoreaderSyncPath(editingPath);
                    setEditingPath(null);
                  });
                }}
                className="flex items-center gap-1.5"
              >
                <input autoFocus value={editingPath} onChange={(e) => setEditingPath(e.target.value)} className="h-8 w-56 rounded-md px-2 font-mono text-xs" aria-label="Carpeta o archivo en Dropbox" />
                <button disabled={busy === "path"} className="h-8 px-2.5 rounded-lg font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                  OK
                </button>
              </form>
            ) : (
              <button onClick={() => setEditingPath(s.path)} className="ghost-action font-mono px-1 -mx-1" title="Cambiar la carpeta o el archivo">
                {s.path}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={syncNow} disabled={!!busy} className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold disabled:opacity-60" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              {busy === "sync" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Sincronizar ahora
            </button>
            {s.pending > 0 && onOpenPending && (
              <button onClick={onOpenPending} className="hover-surface h-9 px-3 text-sm font-semibold" style={{ border: "1px solid var(--accent)", color: "var(--accent-strong)" }}>
                {s.pending === 1 ? "1 libro nuevo para confirmar" : `${s.pending} libros nuevos para confirmar`}
              </button>
            )}
            <button onClick={() => run("off", () => api.disconnectDropbox())} disabled={!!busy} className="ghost-action text-xs px-2 py-1 ml-auto" style={{ color: "var(--text-muted)" }}>
              Desconectar
            </button>
          </div>
        </>
      )}

      {(message || (s.connected && s.lastError)) && (
        <p className="flex items-start gap-1.5 text-xs" style={{ color: message && !s.lastError ? "var(--text-muted)" : "var(--status-warning)" }}>
          {(s.lastError || !message?.startsWith("Listo")) && <AlertCircle size={13} className="shrink-0 mt-px" />}
          {message || s.lastError}
        </p>
      )}

      {s.configured && <KindleGuide />}
    </section>
  );
}
