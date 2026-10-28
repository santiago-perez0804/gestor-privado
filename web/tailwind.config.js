export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      // Escritorio con alto suficiente: páginas de alto fijo con listas que scrollean por separado
      // (Plan y rutinas). En ventanas bajas o en el celular, la página scrollea normal.
      screens: { fit: { raw: "(min-width: 1024px) and (min-height: 640px)" } },
      // Bordes sin color explícito usan el del tema (claro u oscuro).
      borderColor: { DEFAULT: "var(--border)" },
      // Títulos de obras y reseñas (Ocio). Sin red, cae en Georgia.
      fontFamily: { serif: ['"Newsreader"', "Georgia", "serif"] },
    },
  },
  plugins: [],
};
