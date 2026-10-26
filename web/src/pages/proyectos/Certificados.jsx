import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { inputClass } from "../../components/common/FieldLabel.jsx";
import { CertificateForm } from "../../components/proyectos/CertificateForm.jsx";
import { CertificateList, splitSkills } from "../../components/proyectos/CertificateList.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

export function Certificados() {
  const certificatesApi = useApi(api.getCertificates, []);
  const [query, setQuery] = useState("");

  async function handleAdd(formData) {
    const created = await api.addCertificate(formData);
    certificatesApi.setData((prev) => [created, ...(prev || [])]);
  }

  async function handleUpdate(id, formData) {
    const updated = await api.updateCertificate(id, formData);
    certificatesApi.setData((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  async function handleDelete(id) {
    await api.deleteCertificate(id);
    certificatesApi.setData((prev) => prev.filter((c) => c.id !== id));
  }

  if (!certificatesApi.data) return null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? certificatesApi.data.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.issuer || "").toLowerCase().includes(q) ||
          splitSkills(c.skills).some((s) => s.toLowerCase().includes(q))
      )
    : certificatesApi.data;

  return (
    <PageTransition>
      <PageHeader title="Certificados" subtitle={`${certificatesApi.data.length} cursos completados`} />
      <div className="flex flex-col gap-4">
        <Card>
          <SectionHeading icon={Plus}>Nuevo certificado</SectionHeading>
          <CertificateForm onSubmit={handleAdd} />
        </Card>
        {certificatesApi.data.length > 0 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por curso, institución o habilidad"
            className={inputClass()}
          />
        )}
        <CertificateList certificates={filtered} onUpdate={handleUpdate} onDelete={handleDelete} />
      </div>
    </PageTransition>
  );
}
