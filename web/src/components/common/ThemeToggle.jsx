import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme.js";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="hover-surface flex items-center justify-center rounded-lg"
      style={{ width: 32, height: 32, color: "var(--text-muted)", border: "1px solid var(--border)" }}
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
