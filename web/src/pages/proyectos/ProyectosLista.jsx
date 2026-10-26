import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { ProjectCard } from "../../components/proyectos/ProjectCard.jsx";
import { ProjectQuickForm } from "../../components/proyectos/ProjectQuickForm.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

export function ProyectosLista() {
  const projectsApi = useApi(api.getProjects, []);

  async function handleAdd(data) {
    const created = await api.addProject(data);
    projectsApi.setData((prev) => [...(prev || []), created]);
  }

  if (!projectsApi.data) return null;

  return (
    <PageTransition>
      <PageHeader title="Mis proyectos" subtitle="Cuentas y proyectos con estadísticas" />
      <div className="flex flex-col gap-4">
        {projectsApi.data.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
        <ProjectQuickForm onAdd={handleAdd} />
      </div>
    </PageTransition>
  );
}
