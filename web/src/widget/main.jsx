import React from "react";
import ReactDOM from "react-dom/client";
import { FrogWidget } from "./FrogWidget.jsx";
import { applyFinanceSettings } from "../lib/bootstrap.js";
import "../index.css";
import "./widget.css";

// La app y el widget comparten origen: si cambiás el tema en la app, el sapo lo sigue.
window.addEventListener("storage", (e) => {
  if (e.key !== "theme") return;
  if (e.newValue === "dark" || e.newValue === "light") document.documentElement.setAttribute("data-theme", e.newValue);
  else document.documentElement.removeAttribute("data-theme");
});

applyFinanceSettings().then(() =>
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <FrogWidget />
    </React.StrictMode>
  )
);
