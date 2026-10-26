const { contextBridge, ipcRenderer } = require("electron");

// Lo que la ventana del gestor puede pedirle a la app de escritorio.
contextBridge.exposeInMainWorld("gestorDesktop", {
  // Guarda la página actual como PDF (con los estilos de impresión). `name` va sin extensión.
  savePdf: (name) => ipcRenderer.invoke("app:save-pdf", name),
  // Abre la ventana de Configuración (la misma que el engranaje del sapo).
  openSettings: () => ipcRenderer.send("frog:open-settings"),
});
