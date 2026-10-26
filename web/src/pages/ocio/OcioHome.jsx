import { Link } from "react-router-dom";
import { Clapperboard, MapPin } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { OcioSummaryCard } from "../../components/ocio/OcioSummaryCard.jsx";
import { UpcomingOutingsCard } from "../../components/ocio/UpcomingOutingsCard.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

const PILLS = [
  { to: "/ocio/medios", label: "Medios", icon: Clapperboard },
  { to: "/ocio/salidas", label: "Salidas", icon: MapPin },
];

export function OcioHome() {
  const mediaApi = useApi(api.getMediaItems, []);
  const outingsApi = useApi(api.getOutings, []);

  if (!mediaApi.data || !outingsApi.data) return null;

  return (
    <PageTransition>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-base font-semibold">Ocio</h1>
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
        <OcioSummaryCard items={mediaApi.data} />
        <UpcomingOutingsCard outings={outingsApi.data} />
      </div>
    </PageTransition>
  );
}
