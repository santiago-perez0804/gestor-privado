import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { MediaTypeFilter } from "../../components/ocio/MediaTypeFilter.jsx";
import { MediaQuickForm } from "../../components/ocio/MediaQuickForm.jsx";
import { MediaList } from "../../components/ocio/MediaList.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

export function OcioMedios() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") || "");
  const mediaApi = useApi(api.getMediaItems, []);

  function handleTypeChange(type) {
    setTypeFilter(type);
    setSearchParams(type ? { type } : {});
  }

  async function handleAdd(data) {
    const created = await api.addMediaItem(data);
    mediaApi.setData((prev) => [created, ...(prev || [])]);
  }

  async function handleUpdate(id, data) {
    const updated = await api.updateMediaItem(id, data);
    mediaApi.setData((prev) => prev.map((m) => (m.id === id ? updated : m)));
  }

  async function handleDelete(id) {
    await api.deleteMediaItem(id);
    mediaApi.setData((prev) => prev.filter((m) => m.id !== id));
  }

  if (!mediaApi.data) return null;
  const filtered = typeFilter ? mediaApi.data.filter((m) => m.type === typeFilter) : mediaApi.data;

  return (
    <PageTransition>
      <PageHeader title="Películas, series, libros y juegos" />
      <div className="flex flex-col gap-4">
        <MediaTypeFilter value={typeFilter} onChange={handleTypeChange} />
        <MediaQuickForm defaultType={typeFilter || undefined} onAdd={handleAdd} />
        <MediaList items={filtered} onUpdate={handleUpdate} onDelete={handleDelete} />
      </div>
    </PageTransition>
  );
}
