const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsBridge", {
  get: () => ipcRenderer.invoke("settings:get"),
  set: (key, value) => ipcRenderer.send("settings:set", { key, value }),
  restart: () => ipcRenderer.send("settings:restart"),
  openLog: () => ipcRenderer.send("settings:open-log"),
  onChange: (cb) => ipcRenderer.on("settings:changed", (_e, state) => cb(state)),
});
