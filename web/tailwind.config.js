export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      // Bordes sin color explícito usan el del tema (claro u oscuro).
      borderColor: { DEFAULT: "var(--border)" },
    },
  },
  plugins: [],
};
