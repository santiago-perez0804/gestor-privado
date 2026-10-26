import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, BarChart3, Loader2, RefreshCw, Settings, TrendingUp } from "lucide-react";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { FieldLabel, inputClass } from "../../components/common/FieldLabel.jsx";
import { IconPicker } from "../../components/common/IconPicker.jsx";
import { LineTimelineChart } from "../../components/common/LineTimelineChart.jsx";
import { StatTile } from "../../components/proyectos/StatTile.jsx";
import { FollowerDeltaBadge } from "../../components/proyectos/FollowerDeltaBadge.jsx";
import { DailyMetricChart } from "../../components/proyectos/DailyMetricChart.jsx";
import { RecentPostsGrid } from "../../components/proyectos/RecentPostsGrid.jsx";
import { InstagramTokenHelp } from "../../components/proyectos/InstagramTokenHelp.jsx";
import { ProjectAvatar } from "../../components/proyectos/ProjectCard.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { PROJECT_ICONS } from "../../lib/icons.js";
import { formatDateTime, formatShortDate, todayDateInputValue } from "../../lib/format.js";

const REFRESH_MS = 5 * 60 * 1000;
const TOKEN_WARNING_DAYS = 7;
const number = new Intl.NumberFormat("es-AR");

const RANGES = [
  { id: "7", label: "7d", days: 7 },
  { id: "30", label: "30d", days: 30 },
  { id: "90", label: "90d", days: 90 },
  { id: "all", label: "Todo", days: null },
];

const METRICS = [
  { id: "reach", label: "Alcance" },
  { id: "views", label: "Visualizaciones" },
  { id: "profileViews", label: "Visitas al perfil" },
  { id: "accountsEngaged", label: "Cuentas que interactuaron" },
];

function rangeStart(days) {
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--surface-alt)" }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className="flex-1 rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap"
          style={{
            background: value === o.id ? "var(--surface)" : "transparent",
            color: value === o.id ? "var(--text)" : "var(--text-muted)",
            boxShadow: value === o.id ? "var(--shadow-sm)" : "none",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ProjectSettings({ project, onSave, onDelete }) {
  const [name, setName] = useState(project.name);
  const [icon, setIcon] = useState(project.icon);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSave({ name: name.trim() || project.name, icon, accessToken: accessToken.trim() || undefined });
      setAccessToken("");
    } catch (err) {
      setError(err.message === "invalid_token" ? "Instagram rechazó el token." : "No se pudo guardar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <SectionHeading icon={Settings}>Configuración</SectionHeading>
      <form onSubmit={submit} className="space-y-2.5">
        <div className="flex items-end gap-2">
          <IconPicker value={icon} autoIconName="Instagram" options={PROJECT_ICONS} onChange={setIcon} />
          <div className="flex-1">
            <FieldLabel>Nombre</FieldLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass()} />
          </div>
        </div>
        <div>
          <FieldLabel>{project.connected ? "Reemplazar token de Instagram" : "Token de Instagram"}</FieldLabel>
          <input type="password" autoComplete="off" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="IGAA…" className={inputClass()} />
        </div>
        <InstagramTokenHelp />
        {error && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
            {loading && <Loader2 size={13} className="animate-spin" />}
            Guardar
          </button>
          <button type="button" onClick={onDelete} className="rounded-lg px-3 py-1.5 text-xs font-medium ml-auto" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            Borrar proyecto
          </button>
        </div>
      </form>
    </Card>
  );
}

export function ProyectoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const projectApi = useApi(() => api.getProject(id), [id]);
  const snapshotsApi = useApi(() => api.getProjectSnapshots(id), [id]);
  const [live, setLive] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState("30");
  const [metric, setMetric] = useState("reach");
  const [showSettings, setShowSettings] = useState(false);

  const connected = projectApi.data?.connected;
  const { reload: reloadProject } = projectApi;
  const { reload: reloadSnapshots } = snapshotsApi;

  const refreshLive = useCallback(
    async (fresh = false) => {
      setRefreshing(true);
      try {
        setLive(await api.getProjectLive(id, { fresh }));
        setLiveError(null);
      } catch (err) {
        setLiveError(err.message);
      } finally {
        setRefreshing(false);
        // El endpoint en vivo actualiza el snapshot del día, así que refrescamos la serie y los deltas.
        reloadProject();
        reloadSnapshots();
      }
    },
    [id, reloadProject, reloadSnapshots]
  );

  useEffect(() => {
    if (!connected) return;
    refreshLive();
    const timer = setInterval(() => refreshLive(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [connected, refreshLive]);

  async function handleSave(data) {
    const updated = await api.updateProject(id, data);
    projectApi.setData(updated);
    if (data.accessToken) refreshLive(true);
    setShowSettings(false);
  }

  async function handleDelete() {
    if (!window.confirm("¿Borrar este proyecto y todo su historial?")) return;
    await api.deleteProject(id);
    navigate("/proyectos", { replace: true });
  }

  if (projectApi.error?.message === "not_found") return <Navigate to="/proyectos" replace />;
  if (!projectApi.data || !snapshotsApi.data) return null;

  const project = projectApi.data;
  const start = rangeStart(RANGES.find((r) => r.id === range).days);
  const inRange = snapshotsApi.data.filter((s) => !start || s.date >= start);
  const followersSeries = inRange
    .filter((s) => s.followers != null)
    .map((s) => ({ date: formatShortDate(s.date), value: s.followers }));
  const metricLabel = METRICS.find((m) => m.id === metric).label;
  const metricSeries = inRange
    .filter((s) => s[metric] != null)
    .map((s) => ({ date: formatShortDate(s.date), value: s[metric] }));
  const rangeDelta = followersSeries.length > 1 ? followersSeries.at(-1).value - followersSeries[0].value : null;

  const profile = live?.profile;
  const followers = profile?.followers ?? project.latest?.followers;
  const tokenDaysLeft = project.tokenExpiresAt
    ? Math.floor((Date.parse(project.tokenExpiresAt) - Date.now()) / 86400000)
    : null;
  const syncProblem = liveError || project.lastSyncError;

  return (
    <PageTransition>
      <PageHeader
        title={project.name}
        subtitle={project.igUsername ? `@${project.igUsername}` : "Sin conectar"}
        action={
          <div className="flex items-center gap-1">
            {connected && (
              <button
                onClick={() => refreshLive(true)}
                disabled={refreshing}
                aria-label="Actualizar"
                className="flex items-center justify-center rounded-lg"
                style={{ width: 32, height: 32, color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              </button>
            )}
            <button
              onClick={() => setShowSettings((s) => !s)}
              aria-label="Configuración"
              className="flex items-center justify-center rounded-lg"
              style={{ width: 32, height: 32, color: showSettings ? "var(--accent-strong)" : "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              <Settings size={15} />
            </button>
          </div>
        }
      />
      <div className="flex flex-col gap-4">
        {(showSettings || !connected) && <ProjectSettings project={project} onSave={handleSave} onDelete={handleDelete} />}

        {syncProblem && connected && (
          <Card>
            <div className="flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <AlertTriangle size={15} className="shrink-0" style={{ color: "var(--status-warning)" }} />
              <p>
                No se pudo consultar Instagram{project.lastSyncError ? `: ${project.lastSyncError}` : "."} Se muestran los últimos
                datos guardados. Si el error sigue, reemplazá el token desde Configuración.
              </p>
            </div>
          </Card>
        )}
        {connected && tokenDaysLeft != null && tokenDaysLeft <= TOKEN_WARNING_DAYS && (
          <Card>
            <div className="flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <AlertTriangle size={15} className="shrink-0" style={{ color: "var(--status-warning)" }} />
              <p>El token vence en {Math.max(tokenDaysLeft, 0)} días y no se pudo renovar solo. Generá uno nuevo y cargalo en Configuración.</p>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <ProjectAvatar project={project} size={48} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                Seguidores
              </p>
              <p className="text-3xl font-semibold font-mono leading-tight">{followers != null ? number.format(followers) : "—"}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Últimos 7 días">
              <FollowerDeltaBadge value={project.delta7} />
            </StatTile>
            <StatTile label="Últimos 30 días">
              <FollowerDeltaBadge value={project.delta30} />
            </StatTile>
            <StatTile label="Posts" value={number.format(profile?.mediaCount ?? project.latest?.mediaCount ?? 0)} />
          </div>
          <p className="text-[11px] mt-3" style={{ color: "var(--text-faint)" }}>
            {live ? `Actualizado ${formatDateTime(live.fetchedAt)} · se refresca cada 5 min` : project.lastSyncAt ? `Último sync ${formatDateTime(project.lastSyncAt)}` : "Sin sincronizar todavía"}
          </p>
        </Card>

        <SegmentedControl options={RANGES} value={range} onChange={setRange} />

        <Card>
          <SectionHeading icon={TrendingUp} action={rangeDelta != null && <FollowerDeltaBadge value={rangeDelta} suffix="en el período" />}>
            Crecimiento de seguidores
          </SectionHeading>
          <LineTimelineChart
            data={followersSeries}
            emptyMessage="El historial se arma con un registro por día desde que conectaste la cuenta."
          />
          {snapshotsApi.data.length > 0 && snapshotsApi.data[0].date === todayDateInputValue() && (
            <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
              Hoy es el primer día registrado: la curva va a aparecer a medida que pasen los días.
            </p>
          )}
        </Card>

        <Card>
          <SectionHeading icon={BarChart3}>Actividad diaria</SectionHeading>
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className={`${inputClass()} mb-3`}>
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <DailyMetricChart data={metricSeries} label={metricLabel} />
          <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
            El valor de hoy es parcial y se completa a lo largo del día.
          </p>
        </Card>

        {live && <RecentPostsGrid media={live.media} />}
      </div>
    </PageTransition>
  );
}
