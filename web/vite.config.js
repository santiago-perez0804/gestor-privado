import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: "index.html", widget: "widget.html" },
    },
  },
  server: {
    port: 5173,
    // La lógica pura compartida (../shared) vive fuera de web/: hay que dejar que Vite la sirva.
    fs: { allow: [".."] },
    proxy: {
      "/api": "http://localhost:4000",
      "/photos": "http://localhost:4000",
      "/certificates": "http://localhost:4000",
      "/covers": "http://localhost:4000",
      "/artworks": "http://localhost:4000",
    },
  },
});
