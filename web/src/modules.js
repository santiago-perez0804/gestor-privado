import {
  Award,
  Banknote,
  CalendarClock,
  Camera,
  Clapperboard,
  FileText,
  FileUp,
  FolderKanban,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  MapPin,
  PieChart,
  Popcorn,
  Repeat,
  Ruler,
  Sparkles,
  Target,
  Trophy,
  User,
  Wallet,
} from "lucide-react";

/**
 * Módulos de la app y sus secciones (barra lateral en escritorio; Finanzas también las usa como
 * pestañas en el celular). `badge` es una clave que el módulo puede completar con un número.
 */
export const MODULES = [
  {
    id: "fisico",
    label: "Físico",
    icon: User,
    basePath: "/fisico",
    nav: [
      {
        items: [
          { to: "/fisico", label: "Inicio", icon: LayoutDashboard, end: true },
          { to: "/fisico/progreso", label: "Progreso", icon: LineChart },
          { to: "/fisico/records", label: "Récords", icon: Trophy },
          { to: "/fisico/medidas", label: "Medidas", icon: Ruler },
          { to: "/fisico/fotos", label: "Fotos", icon: Camera },
        ],
      },
    ],
  },
  {
    // El id y la ruta siguen siendo "gastos" (links del widget, datos guardados); el nombre visible es Finanzas.
    id: "gastos",
    label: "Finanzas",
    icon: Wallet,
    basePath: "/gastos",
    nav: [
      {
        label: "General",
        items: [
          { to: "/gastos", label: "Resumen", icon: LayoutDashboard, end: true },
          { to: "/gastos/ingresos", label: "Ingresos", icon: Banknote },
          { to: "/gastos/cuentas", label: "Cuentas", icon: Landmark },
        ],
      },
      {
        label: "Planificar",
        items: [
          { to: "/gastos/metas", label: "Metas", icon: Target },
          { to: "/gastos/deudas", label: "Deudas", icon: HandCoins },
          { to: "/gastos/recurrentes", label: "Recurrentes", icon: Repeat },
          { to: "/gastos/proyeccion", label: "Cuotas", icon: CalendarClock, badge: "installments" },
        ],
      },
      {
        label: "Analizar",
        items: [
          { to: "/gastos/analisis", label: "Análisis", icon: Lightbulb },
          { to: "/gastos/informe", label: "Informe mensual", icon: FileText },
          { to: "/gastos/reportes", label: "Reportes", icon: PieChart },
          { to: "/gastos/tips", label: "Tips", icon: Sparkles },
        ],
      },
      {
        label: "Herramientas",
        items: [{ to: "/gastos/importar", label: "Importar", icon: FileUp }],
      },
    ],
  },
  {
    id: "ocio",
    label: "Ocio",
    icon: Popcorn,
    basePath: "/ocio",
    nav: [
      {
        items: [
          { to: "/ocio", label: "Inicio", icon: LayoutDashboard, end: true },
          { to: "/ocio/medios", label: "Medios", icon: Clapperboard },
          { to: "/ocio/salidas", label: "Salidas", icon: MapPin },
        ],
      },
    ],
  },
  {
    id: "proyectos",
    label: "Proyectos",
    icon: FolderKanban,
    basePath: "/proyectos",
    nav: [
      {
        items: [
          { to: "/proyectos", label: "Inicio", icon: LayoutDashboard, end: true },
          { to: "/proyectos/lista", label: "Proyectos", icon: FolderKanban },
          { to: "/proyectos/certificados", label: "Certificados", icon: Award },
        ],
      },
    ],
  },
];

/** El módulo al que pertenece una ruta (por defecto, el primero). */
export function moduleForPath(pathname) {
  return MODULES.find((m) => pathname === m.basePath || pathname.startsWith(`${m.basePath}/`)) ?? MODULES[0];
}
