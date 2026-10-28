import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { Login } from "./pages/Login.jsx";
import { applyFinanceSettings } from "./lib/bootstrap.js";
import { getSession, UNAUTHENTICATED_EVENT } from "./lib/auth.js";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
const showLogin = (expired) =>
  root.render(
    <React.StrictMode>
      <Login expired={expired} />
    </React.StrictMode>
  );

// Si la sesión vence con la app abierta (o se cierra en otro dispositivo), vuelve el login.
window.addEventListener(UNAUTHENTICATED_EVENT, () => showLogin(true));

getSession().then(async (s) => {
  if (s.authRequired && !s.authenticated) return showLogin(false);
  await applyFinanceSettings();
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
});
