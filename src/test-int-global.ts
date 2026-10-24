import { Pool } from 'pg';

/**
 * Prepara el esquema una sola vez para toda la corrida, ejecutando el MISMO
 * initDb() y el MISMO runner de migraciones que corren en producción. Así los
 * tests validan la migración real en lugar de una copia que puede divergir.
 */
export async function setup() {
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-vitest';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL_TEST ||
    'postgresql://estelares:estelares@localhost:55432/estelares_test';

  const { initDb, pool } = await import('./db');
  const { runMigrations } = await import('./migrations/runner');

  await initDb();
  await runMigrations(pool as unknown as Pool);
  await pool.end();
}
