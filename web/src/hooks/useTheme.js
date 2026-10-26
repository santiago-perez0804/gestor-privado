import { useCallback, useLayoutEffect, useState } from "react";
import { getEffectiveTheme, setTheme as persistTheme } from "../lib/theme.js";

export function useTheme() {
  const [theme, setThemeState] = useState(getEffectiveTheme);

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      // Se parte del tema aplicado en la página: puede haber más de un botón de tema montado.
      const applied = document.documentElement.getAttribute("data-theme") || prev;
      const next = applied === "dark" ? "light" : "dark";
      persistTheme(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
