import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      ran_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, '.');
  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const filename of sqlFiles) {
    const { rows } = await pool.query(
      'SELECT id FROM _migrations WHERE filename = $1',
      [filename]
    );
    if (rows.length > 0) {
      console.log(`[migration] skip ${filename} (already ran)`);
      continue;
    }

    console.log(`[migration] running ${filename}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (filename) VALUES ($1)', [filename]);
    console.log(`[migration] ✓ ${filename}`);
  }
}
