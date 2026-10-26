import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { RecordsList } from "../../components/training/RecordsList.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

export function Records() {
  const recordsApi = useApi(api.getExerciseRecords, []);
  if (!recordsApi.data) return null;

  return (
    <PageTransition>
      <PageHeader title="Récords personales" subtitle="Mejor 1RM estimado por ejercicio" />
      <RecordsList records={recordsApi.data} />
    </PageTransition>
  );
}
