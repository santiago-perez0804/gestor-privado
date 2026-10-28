// Función de Vercel: toda la API (y los archivos: portadas, atril, certificados) con el mismo
// Express del server. La base es Supabase (DATABASE_URL) y los archivos, Supabase Storage.
// La web la sirve Vercel como archivos estáticos (web/dist).
import { createApp } from "../server/src/app.js";

const app = createApp({ serveWeb: false });

export default app;
