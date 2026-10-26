export function getStoredTheme() {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
}

export function setTheme(theme) {
  try {
    if (theme === "light" || theme === "dark") {
      localStorage.setItem("theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      localStorage.removeItem("theme");
      document.documentElement.removeAttribute("data-theme");
    }
  } catch {
    /* localStorage unavailable, theme stays system-default for this session */
  }
}

export function getEffectiveTheme() {
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") return stored;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
