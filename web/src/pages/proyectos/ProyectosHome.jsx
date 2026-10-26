import { Link } from "react-router-dom";
import { Award, ChevronRight, FolderKanban } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { ProjectCard } from "../../components/proyectos/ProjectCard.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

const PILLS = [
  { to: "/proyectos/lista", label: "Proyectos", icon: FolderKanban },
  { to: "/proyectos/certificados", label: "Certificados", icon: Award },
];

export function ProyectosHome() {
  const projectsApi = useApi(api.getProjects, []);
  const certificatesApi = useApi(api.getCertificates, []);

  if (!projectsApi.data || !certificatesApi.data) return null;
  const certificates = certificatesApi.data;
  const totalHours = certificates.reduce((sum, c) => sum + (c.hours || 0), 0);

  return (
    <PageTransition>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-base font-semibold">Proyectos</h1>
        {/* En escritorio estas secciones ya están en la barra lateral. */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end lg:hidden">
          {PILLS.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5"
              style={{ color: "var(--accent-strong)", background: "var(--accent-soft)" }}
            >
              <p.icon size={13} />
              {p.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {projectsApi.data.length === 0 ? (
          <Card>
            <EmptyState icon={FolderKanban}>
              Todavía no tenés proyectos.{" "}
              <Link to="/proyectos/lista" style={{ color: "var(--accent-strong)" }}>
                Crear uno
              </Link>
            </EmptyState>
          </Card>
        ) : (
          projectsApi.data.map((p) => <ProjectCard key={p.id} project={p} />)
        )}

        <Link to="/proyectos/certificados" className="block">
          <Card>
            <SectionHeading icon={Award} action={<ChevronRight size={16} style={{ color: "var(--text-faint)" }} />}>
              Certificados
            </SectionHeading>
            <div className="flex items-baseline gap-4">
              <p className="text-2xl font-semibold font-mono">{certificates.length}</p>
              {totalHours > 0 && (
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {totalHours} h de cursada
                </p>
              )}
            </div>
            {certificates[0] && (
              <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
                Último: {certificates[0].title}
              </p>
            )}
          </Card>
        </Link>
      </div>
    </PageTransition>
  );
}
