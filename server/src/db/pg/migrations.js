// Migraciones de Postgres, numeradas. Cada una corre una sola vez (tabla schema_migrations) y entera
// o nada: va en un solo envío de texto, que Postgres ejecuta como una transacción implícita.
// Para agregar una: sumá { version: "00N_algo", sql } al final; nunca edites una ya aplicada.
import { BASE_SCHEMA } from "./schema.js";
import { learnSchema } from "../pg.js";

/**
 * Cierre de la base al mundo (se aplica en cada arranque; es idempotente):
 * - RLS activado en todas las tablas y sin políticas: la API REST pública de Supabase no ve nada.
 * - Sin permisos para los roles públicos de Supabase (anon / authenticated), ni para tablas futuras.
 * El server entra con el usuario dueño de la base, que no pasa por RLS.
 * En PGlite (tests y desarrollo) esos roles no existen y esa parte se saltea.
 */
export const LOCKDOWN = `
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';
  END IF;
END $$;
`;

export const MIGRATIONS = [{ version: "001_base", sql: BASE_SCHEMA }];

for (const m of MIGRATIONS) learnSchema(m.sql);

/** Aplica las migraciones pendientes y el cierre. Devuelve las versiones aplicadas ahora. */
export async function migrate(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)");
  const done = new Set((await db.prepare("SELECT version FROM schema_migrations").all()).map((r) => r.version));
  const applied = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    if (!/^[0-9a-z_]+$/.test(m.version)) throw new Error(`versión inválida: ${m.version}`);
    await db.exec(`${m.sql}\n;INSERT INTO schema_migrations (version, appliedAt) VALUES ('${m.version}', '${new Date().toISOString()}');`);
    applied.push(m.version);
  }
  await db.exec(LOCKDOWN);
  return applied;
}
