# La app en la nube: Supabase + Vercel

Una sola base (Supabase) que usan el celular, la compu y la app de escritorio. Vercel sirve la web y
la API desde el mismo dominio, con login. Este documento es lo que tenés que hacer vos (una vez).

```
iPhone / PC / app de escritorio ──HTTPS──> Vercel (tu dominio)
                                            ├─ la web
                                            └─ /api → la misma API de siempre
                                                       ├─ Postgres de Supabase (la base)
                                                       └─ Storage de Supabase (fotos, portadas, atril, certificados)
```

## Qué es público y qué no

- **La URL de Vercel es pública, los datos no.** Sin sesión, todo `/api` y todos los archivos
  responden 401. Lo único visible sin entrar es la pantalla de login.
- **Login solo para vos.**
  - Usuario de Supabase con email y contraseña.
  - Los registros están apagados.
  - El server además exige que el email sea `OWNER_EMAIL`.
- **La sesión vive en cookies `httpOnly`.** El JavaScript de la página no las puede leer. Dura 60
  días y se renueva sola.
- **La API pública de Supabase no ve nada.** Las tablas tienen RLS sin políticas y los roles
  públicos no tienen permisos, así que aunque alguien tenga la URL del proyecto y la clave `anon`,
  no lee ni escribe nada.
- **Los buckets son privados.** Las fotos se ven solo con sesión, por un link firmado que dura 2 minutos.
- **Las claves van solo en Vercel.** La `service_role`, la de la base y el resto de los secretos van
  en las variables de entorno de Vercel. Nunca en el código ni en la web.

## 1. Supabase

1. **Authentication → Sign In / Providers → Email**: dejá activado Email y **apagá "Allow new
   users to sign up"**.
2. **Authentication → Users → Add user → Create new user**: tu email y una contraseña larga.
   Marcá *Auto Confirm User*.
3. **Storage**: no hace falta crear nada. La app crea sola los buckets privados `photos`, `covers`,
   `artworks`, `certificates`, `imports` y `backups`. Si ya creaste alguno, fijate que diga
   *Private*.

## 2. Variables de entorno en Vercel

**Project → Settings → Environment Variables** (para *Production*; si querés probar en *Preview*,
también ahí):

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | Supabase → **Connect** → *Transaction pooler* (puerto **6543**), con la contraseña de la base |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` / *secret* (¡nunca en la web!) |
| `SUPABASE_ANON_KEY` | (opcional) la `anon` / *publishable* |
| `SUPABASE_JWT_SECRET` | (opcional) solo si tu proyecto usa la clave JWT vieja: JWT Keys → *Legacy JWT secret* |
| `OWNER_EMAIL` | el email del usuario que creaste |
| `CRON_SECRET` | uno al azar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TOKEN_ENCRYPTION_KEY` | uno al azar: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NODE_ENV` | `production` |
| `TMDB_READ_TOKEN`, `RAWG_API_KEY`, `GOOGLE_BOOKS_API_KEY`, `OPENLIBRARY_CONTACT` | los mismos de tu `.env` (si los usás) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | los mismos (si usás Google Calendar) |
| `GOOGLE_REDIRECT_URI` | (opcional) por defecto `https://TU-DOMINIO/api/google/callback`, con el dominio de producción de Vercel |
| `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` | los mismos (si usás el Kindle por Dropbox) |
| `DROPBOX_REDIRECT_URI` | (opcional) por defecto `https://TU-DOMINIO/api/dropbox/callback` |

Si usás Google o Dropbox, agregá esas dos URLs de retorno en sus consolas:

- Google Cloud → Credenciales → tu ID de cliente → *URIs de redireccionamiento autorizados*.
- Dropbox → tu app → *Redirect URIs*.

## 3. Configuración del proyecto en Vercel

- **Settings → Build and Deployment → Root Directory**: vacío (la raíz del repo, **no** `web`).
  Todo lo demás lo toma de `vercel.json`: build, salida, función de la API, región São Paulo y la
  tarea diaria.
- **Node.js Version**: 22.x.
- Hacé *Redeploy* después de cargar las variables.

## 4. Mudar tus datos (una vez)

1. **Cerrá la app de escritorio**, así nadie escribe en la base mientras se copia.
2. En la raíz del proyecto creá (o completá) el archivo `.env` con `DATABASE_URL`, `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` (los mismos valores que en Vercel). El `.env` no se sube a GitHub.
3. Probá primero (no toca Supabase):

   ```
   cd server
   node scripts/migrateToSupabase.mjs --dry-run
   ```

   Tiene que terminar con "✔ Verificación: misma cantidad de filas y mismo contenido".
4. La mudanza de verdad:

   ```
   node scripts/migrateToSupabase.mjs
   ```

   - Copia la base (tu archivo `server/data/fisico.db` no se modifica) y sube fotos, portadas,
     atril y certificados.
   - Si Supabase ya tiene datos, se frena; para pisarlos, `--force`.
5. Entrá a `https://TU-DOMINIO`, iniciá sesión y revisá que esté todo.

`server/data/fisico.db` queda como respaldo. Desde la mudanza, la base de verdad es la de Supabase.

## 5. En el iPhone

Safari → `https://TU-DOMINIO` → iniciá sesión → **Compartir → Agregar a pantalla de inicio**. El
ícono es el sapo. Para que funcione como app instalada (pantalla completa, sin barra de Safari),
seguí `docs/PWA.md`.

## 6. La app de escritorio

Para que use la nube (los mismos datos que el celular), agregá al `.env` de la raíz:

```
GESTOR_URL=https://TU-DOMINIO
```

Si la app está instalada (empaquetada), va en el `.env` de su carpeta de datos
(`%APPDATA%\Gestor Sapo\.env`). Reiniciá la app.

- La primera vez te pide el login. Después recuerda la sesión, y el widget del sapo usa la misma.
- Sin `GESTOR_URL` sigue funcionando como antes, con el server y la base locales.

## 7. Tareas automáticas

- **Una vez por día (06:00 de Argentina)**, Vercel corre `/api/cron/daily`:
  - genera los gastos e ingresos fijos;
  - hace un backup de toda la base en el bucket `backups` (guarda los últimos 30);
  - sincroniza Google Calendar, el Kindle (Dropbox) e Instagram.
- **Al abrir la app**, el primer pedido del día también genera los fijos vencidos.
- **Al cambiar una salida**, Google se actualiza al momento.
- **El Kindle** se revisa al abrir la pantalla de lecturas.
- **Esto también evita la pausa de Supabase**: su plan gratis pausa los proyectos sin uso por 7 días,
  y el cron diario lo mantiene activo.

## 8. Verificar que nada quede expuesto

Con la clave `anon` del proyecto (la pública):

```
curl "https://TU-PROYECTO.supabase.co/rest/v1/weights?select=*" -H "apikey: TU_ANON_KEY"
```

Tiene que responder un error de permisos o `[]`, nunca tus pesadas. Y sin sesión:

```
curl -i https://TU-DOMINIO/api/fisico/home
```

Tiene que dar `401`.

## Límites a tener en cuenta (planes gratis)

- **Subidas:** Vercel acepta pedidos de hasta 4,5 MB. Las fotos de progreso ya se comprimen en el
  celular. Una obra del atril o un PDF muy pesado puede no entrar: achicalo antes. El
  `statistics.sqlite3` del Kindle conviene sincronizarlo por Dropbox, no subirlo a mano.
- **Espacio:** Supabase gratis da 500 MB de base y 1 GB de archivos. Hoy usás ~2 MB de base y
  ~31 MB de archivos.
