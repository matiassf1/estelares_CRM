import 'dotenv/config';
import { createApp } from './app';
import { initDb, pool } from './db';
import { runMigrations } from './migrations/runner';

const PORT = process.env.PORT || 3000;

// Una única definición de la app, compartida con los tests de integración.
// Antes index.ts replicaba el wiring de app.ts: una ruta montada en uno de los
// dos archivos pasaba los tests sin existir en producción, o al revés.
const app = createApp({ serveStatic: true });

async function start() {
  await initDb();
  await runMigrations(pool);
  app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
}

start().catch(console.error);
