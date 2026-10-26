const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, globalShortcut, session, shell, nativeTheme, dialog } = require("electron");
const { fork, spawn } = require("node:child_process");
const { join } = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const cursor = require("./cursor.js");
const overlayMouse = require("./overlayMouse.js");
const { makeFrogIconPng } = require("./icon.js");

const ROOT = join(__dirname, "..");
const PORT = process.env.PORT || 4000;
const BASE_URL = `http://localhost:${PORT}`;
const HOTKEY = "CommandOrControl+Alt+S";
const PREFS_PATH = () => join(app.getPath("userData"), "frog-prefs.json");
const LOG_PATH = () => join(app.getPath("userData"), "desktop.log");

// Chromium deja de pintar las ventanas que cree tapadas. El overlay del sapo ocupa todo el monitor
// (aunque sea transparente) y con un video de fondo Windows recalcula seguido qué está tapado:
// la ventana del gestor podía quedar en blanco. Sin este cálculo siempre se pinta.
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

/** Una ventana overlay transparente por monitor; el sapo vive en una sola a la vez. */
const overlays = new Map(); // displayId -> BrowserWindow
// Estado del mouse de cada overlay: qué pide el widget (clickThrough), si el cursor está cerca del
// sapo (near), sus zonas interactivas y el modo aplicado. Ver overlayMouse.js.
const overlayMouseState = new WeakMap(); // BrowserWindow -> { clickThrough, near, zones, applied }

function mouseStateOf(win) {
  let state = overlayMouseState.get(win);
  if (!state) {
    state = { clickThrough: true, near: false, zones: [], applied: null };
    overlayMouseState.set(win, state);
  }
  return state;
}
let ownerId = null;
let frogHidden = false;
let appWindow = null;
let tray = null;
let serverProcess = null;
let quitting = false;
let prefs = { tongueEnabled: true, autoStart: true };

function loadPrefs() {
  try {
    prefs = { ...prefs, ...JSON.parse(fs.readFileSync(PREFS_PATH(), "utf-8")) };
  } catch {
    /* primera vez: quedan los valores por defecto */
  }
}

function savePrefs() {
  try {
    fs.writeFileSync(PREFS_PATH(), JSON.stringify(prefs));
  } catch (err) {
    console.warn("[desktop] no se pudieron guardar las preferencias:", err.message);
  }
}

/** Deja registro de fallas (procesos caídos, ventanas colgadas) para poder diagnosticarlas después. */
function logEvent(message) {
  const line = `${new Date().toISOString()} ${message}
`;
  console.warn("[desktop]", message);
  try {
    const path = LOG_PATH();
    if (fs.existsSync(path) && fs.statSync(path).size > 256 * 1024) fs.renameSync(path, `${path}.old`);
    fs.appendFileSync(path, line);
  } catch {
    /* sin log no pasa nada */
  }
}

/** Cambia una preferencia desde la bandeja o la ventana de configuración y la aplica. */
function setPref(key, value) {
  prefs = { ...prefs, [key]: value };
  savePrefs();
  if (key === "autoStart") setOpenAtLogin(value);
  if (key === "tongueEnabled") broadcast("frog:prefs", prefs);
  refreshTrayMenu();
  notifySettings();
}

// ---------- cambios en el código ----------

// Sin empaquetar, la app corre directo desde las carpetas del proyecto. La web (gestor y sapo) se
// sirve compilada desde web/dist: si el código fuente es más nuevo, se recompila al arrancar.
// El server y este archivo se leen de nuevo en cada arranque, así que con reiniciar alcanza.
const WEB_DIR = join(ROOT, "web");
const WEB_INPUTS = ["src", "index.html", "widget.html", "tailwind.config.js", "vite.config.js", "postcss.config.js", "package.json"];

function newestMtime(path) {
  let st;
  try {
    st = fs.statSync(path);
  } catch {
    return 0;
  }
  if (!st.isDirectory()) return st.mtimeMs;
  let max = st.mtimeMs;
  for (const name of fs.readdirSync(path)) max = Math.max(max, newestMtime(join(path, name)));
  return max;
}

function webBuiltAt() {
  try {
    return fs.statSync(join(WEB_DIR, "dist", "index.html")).mtimeMs;
  } catch {
    return 0;
  }
}

function webIsStale() {
  if (app.isPackaged) return false;
  const built = webBuiltAt();
  return !built || WEB_INPUTS.some((p) => newestMtime(join(WEB_DIR, p)) > built);
}

function buildWeb() {
  return new Promise((resolve, reject) => {
    const child = spawn("npm run build", { cwd: WEB_DIR, shell: true, windowsHide: true });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(output.slice(-1500) || `código ${code}`))));
  });
}

/** Ventanita mientras se compila, para que no parezca que la app no abrió. */
function showSplash(text) {
  const win = new BrowserWindow({ width: 320, height: 96, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, show: false });
  const html = `<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;gap:12px;font:14px system-ui;background:#171e18;color:#edf2ec">
    <span style="font-size:22px">🐸</span><span>${text}</span></body>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  win.once("ready-to-show", () => win.show());
  return win;
}

async function buildIfStale() {
  if (!webIsStale()) return;
  const splash = showSplash("Aplicando cambios del código…");
  try {
    await buildWeb();
    logEvent("web recompilada al arrancar");
  } catch (err) {
    logEvent(`no se pudo compilar la web, sigue la versión anterior: ${err.message}`);
  } finally {
    if (!splash.isDestroyed()) splash.destroy();
  }
}

/** Reinicia todo (server incluido) para tomar los cambios; al volver a arrancar recompila si hace falta. */
function restartApp() {
  quitting = true;
  if (serverProcess) serverProcess.kill();
  app.relaunch();
  app.exit(0);
}

// ---------- inicio con Windows ----------

// Sin empaquetar (`electron .`) el exe es el Electron genérico: hay que pasarle la carpeta de la app,
// si no Windows abre la pantalla de bienvenida de Electron en vez del sapo.
function loginItemOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}

function setOpenAtLogin(enabled) {
  app.setLoginItemSettings({ openAtLogin: enabled, ...loginItemOptions() });
}

// ---------- server ----------

function ping() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/settings`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  if (await ping()) return;
  // Sin empaquetar usamos la misma base que `npm run dev`/`serve` (server/data): si no, al arrancar
  // con Windows el server levantaba una base vacía aparte y parecía que se habían borrado los datos.
  const dataDir = app.isPackaged ? join(app.getPath("userData"), "data") : join(ROOT, "server", "data");
  const env = { ...process.env, PORT: String(PORT), DATA_DIR: dataDir };
  // El server local lo usa solo este equipo: sin basic auth para que el widget pueda pedir datos.
  delete env.AUTH_USER;
  delete env.AUTH_PASS;
  serverProcess = fork(join(ROOT, "server", "src", "index.js"), [], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  serverProcess.on("exit", (code) => {
    serverProcess = null;
    if (!quitting) console.error(`[desktop] el server terminó (código ${code})`);
  });
  for (let i = 0; i < 60; i++) {
    if (await ping()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("El server no respondió en 15 segundos");
}

// ---------- overlays (uno por monitor) ----------

function displayInfo() {
  return screen.getAllDisplays().map((d, i) => ({ id: d.id, index: i + 1, workArea: d.workArea }));
}

function displayIdOf(win) {
  for (const [id, w] of overlays) if (w === win) return id;
  return null;
}

function broadcast(channel, payload) {
  for (const w of overlays.values()) if (!w.isDestroyed()) w.webContents.send(channel, payload);
}

function createOverlay(display) {
  const win = new BrowserWindow({
    ...display.workArea,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true);
  overlayMouse.applyMouseMode(win, mouseStateOf(win));
  win.loadURL(`${BASE_URL}/widget.html?display=${display.id}`);
  win.once("ready-to-show", () => {
    if (!frogHidden) win.showInactive();
  });
  // Si el proceso del overlay se cae, la ventana queda vacía (o blanca): la armamos de nuevo.
  win.webContents.on("render-process-gone", (_e, details) => {
    logEvent(`overlay ${display.id}: render-process-gone (${details.reason}, código ${details.exitCode})`);
    scheduleRebuild();
  });
  win.on("unresponsive", () => logEvent(`overlay ${display.id}: no responde`));
  return win;
}

function rebuildOverlays() {
  for (const w of overlays.values()) if (!w.isDestroyed()) w.destroy();
  overlays.clear();
  const displays = screen.getAllDisplays();
  if (!displays.some((d) => d.id === ownerId)) ownerId = screen.getPrimaryDisplay().id;
  for (const d of displays) overlays.set(d.id, createOverlay(d));
  if (tray) refreshTrayMenu();
}

let rebuildTimer = null;
function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildOverlays, 600);
}

function moveFrogTo(displayId) {
  ownerId = displayId;
  broadcast("frog:owner", ownerId);
  overlays.get(displayId)?.webContents.send("frog:arrive", null);
}

function setFrogHidden(hidden) {
  frogHidden = hidden;
  for (const w of overlays.values()) {
    if (hidden) w.hide();
    else w.showInactive();
  }
  refreshTrayMenu();
  notifySettings();
}

// ---------- ventana del gestor ----------

let appMoveTimer = null;

/** Copia el color de fondo real de la página (sigue el tema claro/oscuro elegido en la app). */
function syncAppBackground() {
  if (!appWindow || appWindow.isDestroyed()) return;
  appWindow.webContents
    .executeJavaScript("getComputedStyle(document.body).backgroundColor")
    .then((color) => {
      if (color && appWindow && !appWindow.isDestroyed()) appWindow.setBackgroundColor(color);
    })
    .catch(() => {});
}

function openApp(route = "/fisico") {
  const url = `${BASE_URL}${route.startsWith("/") ? route : `/${route}`}`;
  if (!appWindow || appWindow.isDestroyed()) {
    appWindow = new BrowserWindow({
      width: 480,
      height: 860,
      title: "Gestor",
      icon: nativeImage.createFromBuffer(makeFrogIconPng(64)),
      autoHideMenuBar: true,
      // Fondo nativo igual al de la app: si Chromium muestra un cuadro vacío (p. ej. al pasar a un
      // monitor con otra frecuencia), se ve del mismo color y no un destello blanco.
      backgroundColor: nativeTheme.shouldUseDarkColors ? "#10140f" : "#f5f6f4",
      webPreferences: { preload: join(__dirname, "app-preload.js") },
    });
    appWindow.webContents.on("did-finish-load", syncAppBackground);
    // Mientras se arrastra el gestor, el sapo deja de redibujarse: así Windows no tiene que
    // recomponer la ventana debajo de un overlay que cambia en cada cuadro (titilaba).
    appWindow.on("will-move", () => {
      if (!appMoveTimer) {
        broadcast("frog:pause", true);
        syncAppBackground();
      }
      clearTimeout(appMoveTimer);
      appMoveTimer = setTimeout(() => {
        appMoveTimer = null;
        broadcast("frog:pause", false);
      }, 400);
    });
    appWindow.webContents.on("render-process-gone", (_e, details) => {
      logEvent(`gestor: render-process-gone (${details.reason}, código ${details.exitCode})`);
      if (!quitting && appWindow && !appWindow.isDestroyed()) appWindow.webContents.reload();
    });
    appWindow.on("unresponsive", () => logEvent("gestor: no responde"));
    appWindow.on("responsive", () => logEvent("gestor: volvió a responder"));
    appWindow.on("close", (e) => {
      if (!quitting) {
        e.preventDefault();
        appWindow.hide();
      }
    });
  }
  appWindow.loadURL(url);
  appWindow.show();
  appWindow.focus();
}

// ---------- configuración ----------

let settingsWindow = null;

function settingsState() {
  return { prefs, frogHidden, packaged: app.isPackaged, stale: webIsStale(), builtAt: webBuiltAt() || null };
}

function notifySettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send("settings:changed", settingsState());
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 540,
    resizable: false,
    maximizable: false,
    minimizable: false,
    title: "Configuración",
    icon: nativeImage.createFromBuffer(makeFrogIconPng(64)),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: join(__dirname, "settings-preload.js") },
  });
  settingsWindow.loadFile(join(__dirname, "settings.html"));
  settingsWindow.once("ready-to-show", () => settingsWindow.show());
  // Al volver a la ventana se revisa de nuevo si hay cambios sin aplicar.
  settingsWindow.on("focus", notifySettings);
  settingsWindow.on("closed", () => (settingsWindow = null));
}

ipcMain.handle("settings:get", () => settingsState());
ipcMain.on("settings:set", (_e, { key, value }) => {
  if (key === "frogHidden") setFrogHidden(!!value);
  else if (key === "autoStart" || key === "tongueEnabled") setPref(key, !!value);
});
ipcMain.on("settings:restart", restartApp);
ipcMain.on("settings:open-log", () => {
  if (!fs.existsSync(LOG_PATH())) fs.writeFileSync(LOG_PATH(), "Sin errores registrados todavía.\n");
  shell.openPath(LOG_PATH());
});
ipcMain.on("frog:open-settings", openSettings);

// ---------- tray ----------

function refreshTrayMenu() {
  if (!tray) return;
  const displays = displayInfo();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir gestor", click: () => openApp("/fisico") },
      { label: "Carga rápida", accelerator: HOTKEY, click: openQuickAdd },
      {
        label: frogHidden ? "Mostrar al sapo" : "Esconder al sapo",
        click: () => setFrogHidden(!frogHidden),
      },
      {
        label: "Mover al sapo a…",
        enabled: displays.length > 1,
        submenu: displays.map((d) => ({
          label: `Pantalla ${d.index} (${d.workArea.width}×${d.workArea.height})`,
          type: "radio",
          checked: d.id === ownerId,
          click: () => moveFrogTo(d.id),
        })),
      },
      { type: "separator" },
      {
        label: "Lengua traviesa (agarra el mouse)",
        type: "checkbox",
        checked: prefs.tongueEnabled,
        enabled: cursor.available(),
        click: (item) => setPref("tongueEnabled", item.checked),
      },
      {
        label: "Iniciar con Windows",
        type: "checkbox",
        checked: prefs.autoStart,
        click: (item) => setPref("autoStart", item.checked),
      },
      { type: "separator" },
      { label: "Configuración…", click: openSettings },
      { label: "Aplicar cambios del código (reiniciar)", click: restartApp },
      { label: "Salir", click: () => app.quit() },
    ])
  );
}

function createTray() {
  tray = new Tray(nativeImage.createFromBuffer(makeFrogIconPng(32)));
  tray.setToolTip("Sapo gestor");
  tray.on("click", () => openApp("/fisico"));
  refreshTrayMenu();
}

function openQuickAdd() {
  if (frogHidden) setFrogHidden(false);
  const win = overlays.get(ownerId);
  if (!win) return;
  win.focus();
  win.webContents.send("frog:hotkey", "quick");
}

// ---------- IPC ----------

const senderWindow = (e) => BrowserWindow.fromWebContents(e.sender);

ipcMain.handle("frog:init", (e) => {
  const win = senderWindow(e);
  const displayId = displayIdOf(win);
  return { displayId, bounds: win.getBounds(), displays: displayInfo(), isOwner: displayId === ownerId, prefs };
});

ipcMain.on("frog:set-click-through", (e, ignore) => {
  const win = senderWindow(e);
  if (!win || win.isDestroyed()) return;
  const state = mouseStateOf(win);
  state.clickThrough = !!ignore;
  overlayMouse.applyMouseMode(win, state);
});

// Zonas interactivas del sapo (él, su tarjeta, globos, moscas) en coordenadas del overlay.
ipcMain.on("frog:hit-zones", (e, zones) => {
  const win = senderWindow(e);
  if (win && !win.isDestroyed() && Array.isArray(zones)) mouseStateOf(win).zones = zones;
});

/**
 * Sigue al cursor (~30 veces por segundo): decide en cada overlay si reenviarle el mouse (solo cerca
 * del sapo) y le pasa la posición para que el sapo lo mire aunque no se reenvíe nada.
 */
let lastCursor = null;
function pollCursor() {
  if (frogHidden) return;
  const p = screen.getCursorScreenPoint();
  const moved = !lastCursor || p.x !== lastCursor.x || p.y !== lastCursor.y;
  lastCursor = p;
  for (const win of overlays.values()) {
    if (win.isDestroyed()) continue;
    const b = win.getBounds();
    const local = { x: p.x - b.x, y: p.y - b.y };
    const inside = local.x >= 0 && local.y >= 0 && local.x < b.width && local.y < b.height;
    const state = mouseStateOf(win);
    state.near = inside && overlayMouse.isNear(local, state.zones);
    overlayMouse.applyMouseMode(win, state);
    if (moved && inside) win.webContents.send("frog:cursor", local);
  }
}

/** El sapo cruzó un borde: pasa al monitor que contiene el punto global indicado. */
ipcMain.handle("frog:transfer", (e, { gx, gy, frog }) => {
  const fromId = displayIdOf(senderWindow(e));
  const target = screen.getDisplayNearestPoint({ x: Math.round(gx), y: Math.round(gy) });
  const inside =
    gx >= target.bounds.x && gx < target.bounds.x + target.bounds.width && gy >= target.bounds.y && gy < target.bounds.y + target.bounds.height;
  if (!inside || target.id === fromId || !overlays.has(target.id)) return false;
  ownerId = target.id;
  broadcast("frog:owner", ownerId);
  overlays.get(target.id).webContents.send("frog:arrive", { gx, gy, frog });
  refreshTrayMenu();
  return true;
});

ipcMain.handle("frog:yank-start", () => prefs.tongueEnabled && cursor.canYank());

ipcMain.on("frog:cursor-to", (e, p) => {
  const b = senderWindow(e).getBounds();
  cursor.setCursor({ x: p.x + b.x, y: p.y + b.y });
});

ipcMain.on("frog:open-app", (_e, route) => openApp(route));

// Informe mensual del gestor → PDF: usa los estilos de impresión de la página (@page A4).
ipcMain.handle("app:save-pdf", async (e, name) => {
  const win = senderWindow(e);
  const safeName = String(name || "informe").replace(/[\\/:*?"<>|]+/g, "-");
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Guardar informe en PDF",
    defaultPath: join(app.getPath("documents"), `${safeName}.pdf`),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { canceled: true };
  const pdf = await e.sender.printToPDF({ printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(filePath, pdf);
  shell.showItemInFolder(filePath);
  logEvent(`informe PDF guardado: ${filePath}`);
  return { saved: filePath };
});
ipcMain.on("frog:release-focus", (e) => senderWindow(e)?.blur());

// ---------- ciclo de vida ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId("gestor.sapo");
  app.on("second-instance", () => openApp("/fisico"));

  app.whenReady().then(async () => {
    loadPrefs();
    // Reescribe la entrada en cada arranque: corrige registros viejos y sigue a la carpeta si se mueve.
    setOpenAtLogin(prefs.autoStart);
    await buildIfStale();
    try {
      await ensureServer();
    } catch (err) {
      console.error("[desktop]", err.message);
      app.quit();
      return;
    }
    // Después de un `npm run build` el HTML cambia: evitamos que Electron sirva uno viejo.
    await session.defaultSession.clearCache();
    ownerId = screen.getPrimaryDisplay().id;
    rebuildOverlays();
    createTray();
    globalShortcut.register(HOTKEY, openQuickAdd);

    setInterval(pollCursor, 33);

    screen.on("display-added", scheduleRebuild);
    screen.on("display-removed", scheduleRebuild);
    screen.on("display-metrics-changed", scheduleRebuild);

    // Algunas ventanas (barra de tareas, juegos) le roban el "encima de todo": lo reafirmamos.
    setInterval(() => {
      if (frogHidden) return;
      for (const w of overlays.values()) if (!w.isDestroyed() && w.isVisible()) w.moveTop();
    }, 5000);
  });

  // Cerrar la ventana del gestor no cierra la app: el sapo sigue en el escritorio.
  app.on("window-all-closed", (e) => e.preventDefault());

  // Cuando se cae el proceso de la GPU (drivers, videos con aceleración por hardware), Chromium lo
  // reinicia pero las ventanas transparentes pueden quedar blancas y el gestor sin pintar:
  // rearmamos los overlays y recargamos el gestor.
  app.on("child-process-gone", (_e, details) => {
    logEvent(`proceso ${details.type} caído (${details.reason}, código ${details.exitCode})`);
    if (details.type !== "GPU" || quitting) return;
    scheduleRebuild();
    if (appWindow && !appWindow.isDestroyed()) appWindow.webContents.reload();
  });

  app.on("will-quit", () => globalShortcut.unregisterAll());

  app.on("before-quit", () => {
    quitting = true;
    if (serverProcess) serverProcess.kill();
  });
}
