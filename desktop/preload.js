const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel) {
  return (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld("frogBridge", {
  init: () => ipcRenderer.invoke("frog:init"),
  setClickThrough: (ignore) => ipcRenderer.send("frog:set-click-through", ignore),
  setHitZones: (zones) => ipcRenderer.send("frog:hit-zones", zones),
  transfer: (payload) => ipcRenderer.invoke("frog:transfer", payload),
  yankStart: () => ipcRenderer.invoke("frog:yank-start"),
  cursorTo: (p) => ipcRenderer.send("frog:cursor-to", p),
  openApp: (route) => ipcRenderer.send("frog:open-app", route),
  releaseFocus: () => ipcRenderer.send("frog:release-focus"),
  openSettings: () => ipcRenderer.send("frog:open-settings"),
  onPrefs: subscribe("frog:prefs"),
  onOwner: subscribe("frog:owner"),
  onArrive: subscribe("frog:arrive"),
  onHotkey: subscribe("frog:hotkey"),
  onPause: subscribe("frog:pause"),
  onCursor: subscribe("frog:cursor"),
});
