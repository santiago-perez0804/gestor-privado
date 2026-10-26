import {
  Award,
  BookOpen,
  CalendarDays,
  Gamepad2,
  Library,
  Tv,
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
      { items: [{ to: "/ocio", label: "Inicio", icon: LayoutDashboard, end: true }] },
      {
        label: "Biblioteca",
        items: [
          { to: "/ocio/biblioteca", label: "Todo", icon: Library, end: true, badge: "all" },
          { to: "/ocio/biblioteca/peliculas", label: "Películas", icon: Clapperboard, color: "var(--ocio-movie)", badge: "movie" },
          { to: "/ocio/biblioteca/series", label: "Series", icon: Tv, color: "var(--ocio-series)", badge: "series" },
          { to: "/ocio/biblioteca/libros", label: "Libros", icon: BookOpen, color: "var(--ocio-book)", badge: "book" },
          { to: "/ocio/biblioteca/videojuegos", label: "Videojuegos", icon: Gamepad2, color: "var(--ocio-game)", badge: "game" },
        ],
      },
      {
        label: "Agenda",
        items: [{ to: "/ocio/salidas", label: "Salidas", icon: CalendarDays, badge: "outings" }],
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
