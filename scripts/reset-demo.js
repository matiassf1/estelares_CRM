require('dotenv').config();
const { Pool } = require('pg');

// ── Safety guards ─────────────────────────────────────────────────────────────
if (process.env.ALLOW_DEMO_SEEDS !== 'true') {
  console.error('\nERROR: Set ALLOW_DEMO_SEEDS=true to run reset-demo.');
  console.error('This prevents accidental wipes of production data.\n');
  process.exit(1);
}

// Heuristic: refuse if DATABASE_URL looks like a production Railway URL
// without an obvious demo indicator
const dbUrl = process.env.DATABASE_URL || '';
if (
  dbUrl.includes('railway.app') &&
  !dbUrl.toLowerCase().includes('demo') &&
  !dbUrl.toLowerCase().includes('test') &&
  !dbUrl.toLowerCase().includes('dev')
) {
  console.error('\nERROR: DATABASE_URL appears to be a production Railway database.');
  console.error('Refusing to reset. If this is intentional, check your environment.\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function reset() {
  console.log('\n⚠  Resetting Association Demo data (ALLOW_DEMO_SEEDS=true)...\n');

  // Delete in dependency order (foreign key constraints)
  await pool.query(`DELETE FROM audit_log`);
  await pool.query(`DELETE FROM match_accreditations`);
  await pool.query(`DELETE FROM matches`);
  await pool.query(`DELETE FROM player_registrations`);
  await pool.query(`DELETE FROM players`);
  await pool.query(`DELETE FROM association_operators`);
  await pool.query(`DELETE FROM teams`);
  await pool.query(`DELETE FROM seasons`);
  await pool.query(`DELETE FROM divisions`);
  await pool.query(`DELETE FROM clubs`);
  await pool.query(`DELETE FROM associations`);

  console.log('✅ Reset complete. Run `npm run seed:assoc` to re-populate.\n');
  await pool.end();
}

reset().catch(err => { console.error('\n❌', err.message); pool.end(); process.exit(1); });
