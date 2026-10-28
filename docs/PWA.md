# Convertir el gestor en una PWA (paso a paso)

Guía para que la app se pueda **instalar en el iPhone** (ícono en la pantalla de inicio, pantalla completa) y
**abra sin señal** en el gym. Está pensada para este proyecto tal como está hoy: React + Vite (`web/`), Express +
SQLite (`server/`) en tu PC, y el celular entrando por el túnel de Cloudflare.

> Lo que ya está listo para esto: el entreno en vivo se guarda en el celular después de cada cambio y se sube solo
> con reintentos (`web/src/lib/fisico/workoutDevice.js`, `components/fisico/live/useLiveWorkout.js`), los ids se
> generan en el cliente y el guardado es idempotente. Lo que falta es que la **app en sí** (HTML, JS, CSS) quede
> guardada en el celular: eso es la PWA.

---

## 0. Antes de empezar: qué cambia y qué no

| | Hoy | Con PWA |
|---|---|---|
| Abrir la app sin señal | No carga | Carga desde el celular |
| Entreno a mitad de camino sin señal | Se guarda en el celu | Igual |
| Ícono en la pantalla de inicio | Atajo de Safari | App a pantalla completa |
| Notificación al terminar el descanso (iPhone) | No | Solo con push (paso 9) |
| Los datos (base SQLite) | En tu PC | Siguen en tu PC (hasta migrar a la nube) |

La PWA **no** reemplaza al server: sin conexión vas a ver la app y lo que ya estaba cargado, y lo nuevo se sube
cuando vuelva la señal.

---

## 1. Requisito: una dirección HTTPS fija

Un service worker solo funciona en HTTPS (o `localhost`), y queda atado a **una** dirección. El túnel rápido de
`npm run expose` (`cloudflared tunnel --url …`) cambia de dirección cada vez que lo prendés: con eso la app instalada
quedaría huérfana.

Hay que pasar a un **túnel con nombre** y un dominio fijo (gratis con una cuenta de Cloudflare y un dominio propio):

1. Comprá o usá un dominio y agregalo a Cloudflare (plan gratis).
2. En la PC:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create gestor
   cloudflared tunnel route dns gestor gestor.tudominio.com
   ```
3. Creá `%USERPROFILE%\.cloudflared\config.yml`:
   ```yaml
   tunnel: gestor
   credentials-file: C:\Users\Sapo\.cloudflared\<ID-del-tunel>.json
   ingress:
     - hostname: gestor.tudominio.com
       service: http://localhost:4000
     - service: http_status:404
   ```
4. Cambiá el script `expose` en `package.json` por `cloudflared tunnel run gestor` (o instalalo como servicio de
   Windows: `cloudflared service install`, así arranca solo con la PC).

### Ojo con el usuario y la contraseña

Hoy, cuando se expone por el túnel, la app usa **Basic Auth** (`AUTH_USER` / `AUTH_PASS`). En iPhone, una app
instalada **no maneja bien Basic Auth**: puede pedir la contraseña en cada apertura o fallar sin aviso cuando el
service worker hace pedidos. Dos alternativas, de más simple a más prolija:

- **Cloudflare Access** (recomendado mientras la app viva en tu PC): en el panel de Cloudflare → Zero Trust →
  Access → Applications, protegé `gestor.tudominio.com` con login por mail (código de un solo uso). La cookie dura
  semanas y funciona con la PWA. Después podés sacar `AUTH_USER`/`AUTH_PASS`… pero entonces el server tiene que
  aceptar pedidos que vienen del túnel: hoy los rechaza a propósito si no hay contraseña
  (`server/src/middleware/requestGuard.js`). Habría que permitir el túnel cuando haya Access, por ejemplo
  validando el header `Cf-Access-Jwt-Assertion`.
- **Login propio** (cuando migres a la nube): Supabase/Firebase Auth con sesión guardada. Es lo que va a quedar
  igual.

---

## 2. Íconos

Hacen falta (en `web/public/icons/`):

- `icon-192.png` y `icon-512.png` (cuadrados, fondo sólido).
- `icon-maskable-512.png`: el dibujo dentro del 80 % central (Android lo recorta en círculo).
- `apple-touch-icon.png` de 180 × 180 (iPhone **no** usa los del manifest).

Se pueden generar desde un PNG grande con <https://maskable.app/editor> o con
`npx pwa-asset-generator logo.png web/public/icons`.

---

## 3. El manifest (cómo se ve instalada)

Crear `web/public/manifest.webmanifest`:

```json
{
  "name": "Gestor",
  "short_name": "Gestor",
  "description": "Físico, finanzas, ocio y proyectos",
  "start_url": "/fisico",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0f1412",
  "theme_color": "#0f1412",
  "lang": "es-AR",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Empezar entreno", "url": "/fisico/entreno" },
    { "name": "Gasto rápido", "url": "/gastos" }
  ]
}
```

Y en `web/index.html`, dentro de `<head>`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#0f1412" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Gestor" />
```

`viewport-fit=cover` hace que la app use toda la pantalla del iPhone; las pantallas ya respetan la muesca
(`env(safe-area-inset-*)` en el entreno en vivo). Revisá el resto con la app instalada.

> `web/widget.html` es del widget de escritorio: no lleva manifest.

---

## 4. El service worker (que abra sin señal)

La forma más simple con Vite es **vite-plugin-pwa** (usa Workbox por debajo):

```bash
npm install -D vite-plugin-pwa --prefix web
```

En `web/vite.config.js`:

```js
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",          // avisa cuando hay versión nueva (no recarga en medio de un entreno)
      manifest: false,                 // usamos web/public/manifest.webmanifest
      injectRegister: null,            // lo registramos a mano (paso 5)
      workbox: {
        // La app (HTML, JS, CSS, fuentes locales e íconos) queda guardada en el celular.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Cualquier ruta de la app abre index.html (React Router decide qué mostrar)…
        navigateFallback: "/index.html",
        // …menos la API, los archivos privados y el widget.
        navigateFallbackDenylist: [/^\/api\//, /^\/covers\//, /^\/artworks\//, /^\/certificates\//, /^\/widget/],
        runtimeCaching: [
          // Fuentes de Google: una vez bajadas, sirven sin señal.
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: "StaleWhileRevalidate", options: { cacheName: "fuentes" } },
          // Lo que necesita el entreno para arrancar sin señal (plan, rutina, sugerencias): red primero, si no hay, lo último.
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              /^\/api\/fisico\/(workout\/(today|start|exercise)|plans\/active|settings|exercises)/.test(url.pathname),
            handler: "NetworkFirst",
            options: { cacheName: "fisico-api", networkTimeoutSeconds: 4, expiration: { maxEntries: 80, maxAgeSeconds: 7 * 24 * 3600 } },
          },
          // Portadas de Ocio: se pueden guardar.
          { urlPattern: /^\/covers\//, handler: "CacheFirst", options: { cacheName: "portadas", expiration: { maxEntries: 300 } } },
        ],
      },
    }),
  ],
  // … lo que ya estaba
});
```

**Lo que NO se guarda en caché, a propósito:**
- `/api/fisico/photos/*`: fotos privadas. El server ya las manda con `Cache-Control: private, no-store`; no
  agregues ninguna regla para ellas.
- Escrituras (`POST`, `PUT`, `DELETE`): el entreno ya maneja su propia cola (paso 6).
- Finanzas: mejor ver datos frescos que viejos.

---

## 5. Registrar el service worker y avisar actualizaciones

En `web/src/main.jsx`, después de montar la app:

```js
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  onNeedRefresh() {
    // Hay versión nueva. No recargar si hay un entreno en curso.
    const training = localStorage.getItem("fisico.workout.current");
    if (!training && confirm("Hay una versión nueva del gestor. ¿Actualizar?")) updateSW(true);
  },
  onOfflineReady() {
    console.info("[pwa] lista para usar sin conexión");
  },
});
```

Mejor que `confirm`: un aviso propio con un botón "Actualizar".

Para que **la app de escritorio (Electron) no se vea afectada**: registrá el service worker solo fuera de Electron
(`if (!window.gestorDesktop) registerSW(...)`). Electron ya tiene la app local.

---

## 6. Datos sin conexión

- **Entreno en vivo:** ya funciona (guardado local + subida con reintentos). Con la PWA se suma que **la pantalla
  abre** sin señal y que `GET /api/fisico/workout/start` sale de la caché si se cargó antes. Recomendación: abrí la
  app una vez con señal antes de salir al gym (o agregar un botón "Preparar para el gym" que pida esas rutas).
- **Otras cargas sin conexión** (pesada, gasto rápido): hoy fallan sin señal. Para que se encolen, usar el mismo
  patrón del entreno: guardar el pedido en `localStorage`/IndexedDB con un id propio y reintentar al volver la
  conexión. Con Workbox también existe `BackgroundSyncPlugin`, pero **iOS no lo soporta**: hay que reintentar desde
  la app (al abrirla, en el evento `online` y en `visibilitychange`), como ya hace `useLiveWorkout`.
- **Espacio en iPhone:** Safari puede borrar lo guardado de un sitio que no se usa en 7 días, **pero no** el de una
  app instalada en la pantalla de inicio. Instalala.

---

## 7. El server

Express ya sirve `web/dist` y manda `index.html` para las rutas de la app (`server/src/index.js`). Agregar:

```js
// El service worker nunca se cachea (si no, el celular no ve versiones nuevas).
app.get(["/sw.js", "/manifest.webmanifest"], (req, res, next) => {
  res.set("Cache-Control", "no-cache");
  next();
});
```

Ubicalo antes de `app.use(express.static(webDistPath))` y agregá `/sw.js` y `/manifest.webmanifest` a las
excepciones del `app.get(/^(?!\/api|…)/)` para que no devuelvan `index.html`.

---

## 8. Instalar en el iPhone

1. Abrí `https://gestor.tudominio.com/fisico` en **Safari** (no Chrome: en iOS solo Safari instala PWAs con todo).
2. Compartir → **Agregar a pantalla de inicio**.
3. Abrila desde el ícono una vez **con señal** (ahí se guarda la app).
4. Probá: modo avión → abrir la app → tiene que cargar y dejarte entrenar.

---

## 9. Notificaciones (fin del descanso con la pantalla bloqueada)

En iPhone solo hay notificaciones en apps **instaladas** y desde iOS 16.4, y **solo por push**. El navegador no
puede programar una notificación local para dentro de 2 minutos. Para el descanso:

1. Generar claves VAPID (`npx web-push generate-vapid-keys`) y guardarlas en `.env`.
2. Al empezar el entreno, pedir permiso y suscribir (`registration.pushManager.subscribe`), y mandar la suscripción
   al server.
3. Al tildar una serie, avisar al server "terminá el descanso a las HH:MM:SS"; el server (con la librería
   `web-push`) envía el push a esa hora. Si cambiás a +15/−15 o saltás, se reprograma o se cancela.
4. En el service worker, escuchar `push` y mostrar `self.registration.showNotification("Descanso", { body: "A la siguiente serie" })`.

Limitación: requiere conexión en ese momento (el push viaja por internet). Sin señal, queda el sonido al volver.

---

## 10. Probar

- **Chrome en la PC** → DevTools → Application: ver el manifest, el service worker y las cachés. Marcar "Offline"
  y recargar.
- **Lighthouse** (DevTools) → categoría PWA.
- **iPhone:** pasos del punto 8, más:
  - Cerrar la app a mitad de un entreno y volver a abrirla (tiene que ofrecer retomar).
  - Publicar una versión nueva y ver el aviso de actualización (y que no aparezca con un entreno en curso).
  - `npm test` y `npm run test:integration` siguen en verde (la PWA no toca el server).

---

## 11. Cuando migres a la nube (Supabase / Firebase)

- **Hosting:** la PWA (`web/dist`) va a Vercel, Netlify, Cloudflare Pages o Firebase Hosting, todos con HTTPS. Los
  pasos 2 a 6 se mantienen tal cual.
- **Login:** reemplaza a Basic Auth y Cloudflare Access (Supabase Auth o Firebase Auth).
- **Lógica:** lo de `shared/` (cálculos, reducer del entreno) se usa desde el cliente sin cambios.
- **Datos:** el guardado por snapshot del entreno pasa a ser un `upsert` a la tabla equivalente.
- **Fotos:** van a un bucket privado con URLs firmadas. La interfaz ya está separada en
  `server/src/services/storage/privateFiles.js`.

---

## Checklist

- [ ] Túnel con nombre y dominio fijo (HTTPS)
- [ ] Acceso compatible con PWA (Cloudflare Access o login propio) y `requestGuard` ajustado
- [ ] Íconos (192, 512, maskable, apple-touch-icon)
- [ ] `manifest.webmanifest` + metas en `index.html`
- [ ] `vite-plugin-pwa` configurado (sin cachear fotos ni escrituras)
- [ ] Registro del SW con aviso de actualización (sin recargar en medio de un entreno; no en Electron)
- [ ] Server: `sw.js` y manifest sin caché
- [ ] Instalada en el iPhone y probada en modo avión
- [ ] (Opcional) Push para el fin del descanso
