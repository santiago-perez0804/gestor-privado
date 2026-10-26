import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Card } from "../common/Card.jsx";
import { IconChip } from "../common/IconChip.jsx";
import { FollowerDeltaBadge } from "./FollowerDeltaBadge.jsx";
import { getIconComponent } from "../../lib/icons.js";

const number = new Intl.NumberFormat("es-AR");

export function ProjectAvatar({ project, size = 40 }) {
  if (project.igProfilePictureUrl) {
    return (
      <img
        src={project.igProfilePictureUrl}
        alt=""
        className="rounded-full shrink-0 object-cover"
        style={{ width: size, height: size, border: "1px solid var(--border)" }}
      />
    );
  }
  return <IconChip icon={getIconComponent(project.icon || "Instagram")} size={size} />;
}

export function ProjectCard({ project }) {
  const followers = project.latest?.followers;

  return (
    <Link to={`/proyectos/${project.id}`} className="block">
      <Card>
        <div className="flex items-center gap-3">
          <ProjectAvatar project={project} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{project.name}</p>
            <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
              {project.igUsername ? `@${project.igUsername}` : "Sin conectar"}
            </p>
          </div>
          {project.lastSyncError && (
            <AlertTriangle size={15} style={{ color: "var(--status-warning)" }} aria-label="Error al sincronizar" />
          )}
        </div>

        <div className="flex items-end justify-between gap-3 mt-4">
          <div>
            <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              Seguidores
            </p>
            <p className="text-2xl font-semibold font-mono leading-tight">
              {followers != null ? number.format(followers) : "—"}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <FollowerDeltaBadge value={project.delta7} suffix="7d" />
              <FollowerDeltaBadge value={project.delta30} suffix="30d" />
            </div>
          </div>
          {project.sparkline?.length > 1 && (
            <div style={{ width: 110, height: 44 }} aria-hidden="true">
              <ResponsiveContainer>
                <LineChart data={project.sparkline} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Line type="monotone" dataKey="followers" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
