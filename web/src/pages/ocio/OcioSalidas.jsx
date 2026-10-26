import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { OutingQuickForm } from "../../components/ocio/OutingQuickForm.jsx";
import { OutingsList } from "../../components/ocio/OutingsList.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

export function OcioSalidas() {
  const outingsApi = useApi(api.getOutings, []);

  async function handleAdd(data) {
    const created = await api.addOuting(data);
    outingsApi.setData((prev) => [created, ...(prev || [])]);
  }

  async function handleUpdate(id, data) {
    const updated = await api.updateOuting(id, data);
    outingsApi.setData((prev) => prev.map((o) => (o.id === id ? updated : o)));
  }

  async function handleDelete(id) {
    await api.deleteOuting(id);
    outingsApi.setData((prev) => prev.filter((o) => o.id !== id));
  }

  if (!outingsApi.data) return null;

  return (
    <PageTransition>
      <PageHeader title="Salidas y planes" />
      <div className="flex flex-col gap-4">
        <OutingQuickForm onAdd={handleAdd} />
        <OutingsList outings={outingsApi.data} onUpdate={handleUpdate} onDelete={handleDelete} />
      </div>
    </PageTransition>
  );
}
