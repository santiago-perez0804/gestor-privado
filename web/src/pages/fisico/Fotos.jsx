import { useState } from "react";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PhotoUploadForm } from "../../components/training/PhotoUploadForm.jsx";
import { PhotoGrid } from "../../components/training/PhotoGrid.jsx";
import { PhotoLightbox } from "../../components/training/PhotoLightbox.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

export function Fotos() {
  const photosApi = useApi(api.getProgressPhotos, []);
  const [selected, setSelected] = useState(null);

  function handleUploaded(created) {
    photosApi.setData((prev) => [created, ...(prev || [])]);
  }

  async function handleDelete(id) {
    await api.deleteProgressPhoto(id);
    photosApi.setData((prev) => prev.filter((p) => p.id !== id));
    setSelected(null);
  }

  if (!photosApi.data) return null;

  return (
    <PageTransition>
      <PageHeader title="Fotos de progreso" />
      <div className="flex flex-col gap-4">
        <PhotoUploadForm onUploaded={handleUploaded} />
        <PhotoGrid photos={photosApi.data} onSelect={setSelected} />
      </div>
      <PhotoLightbox photo={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />
    </PageTransition>
  );
}
