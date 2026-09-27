require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ── Safety guards ─────────────────────────────────────────────────────────────
if (process.env.ALLOW_DEMO_SEEDS !== 'true') {
  console.error('\nERROR: ALLOW_DEMO_SEEDS is not set to "true".');
  console.error('This guard prevents accidental seeding of production databases.');
  console.error('Set ALLOW_DEMO_SEEDS=true only on the Association Demo environment.\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function qrSecret() { return crypto.randomBytes(32).toString('hex'); }

async function seed() {
  console.log('\n⚠  ALLOW_DEMO_SEEDS=true detected — seeding Association Demo data\n');

  // Association
  const { rows: [assoc] } = await pool.query(`
    INSERT INTO associations (name, slug, timezone)
    VALUES ('Asociación Tucumana Demo', 'atu-demo', 'America/Argentina/Buenos_Aires')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING *
  `);
  console.log(`[assoc] ${assoc.name} (${assoc.id})`);

  // Division
  const { rows: [div] } = await pool.query(`
    INSERT INTO divisions (association_id, name)
    VALUES ($1, 'Primera')
    ON CONFLICT (association_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING *
  `, [assoc.id]);
  console.log(`[division] ${div.name}`);

  // Season
  const { rows: [season] } = await pool.query(`
    INSERT INTO seasons (association_id, name, starts_at, ends_at, active)
    VALUES ($1, 'Temporada Demo', '2026-01-01', '2026-12-31', true)
    ON CONFLICT (association_id, name) DO UPDATE SET active = true
    RETURNING *
  `, [assoc.id]);
  console.log(`[season] ${season.name}`);

  // Clubs
  const clubDefs = [
    { name: 'Estelares', short_name: 'EST' },
    { name: 'Rival Demo',      short_name: 'RIV' },
    { name: 'Tercer Club Demo', short_name: 'TER' },
  ];
  const clubs = {};
  for (const c of clubDefs) {
    let club;
    try {
      const r = await pool.query(`
        INSERT INTO clubs (association_id, name, short_name)
        VALUES ($1, $2, $3) RETURNING *
      `, [assoc.id, c.name, c.short_name]);
      club = r.rows[0];
    } catch {
      const r = await pool.query(
        `SELECT * FROM clubs WHERE association_id=$1 AND name=$2`, [assoc.id, c.name]);
      club = r.rows[0];
    }
    clubs[c.short_name] = club;
    console.log(`[club] ${club.name}`);
  }

  // Teams
  const teamDefs = [
    { clubKey: 'EST', name: 'Estelares Primera' },
    { clubKey: 'RIV', name: 'Rival Primera' },
    { clubKey: 'TER', name: 'Tercer Club Primera' },
  ];
  const teams = {};
  for (const t of teamDefs) {
    const club = clubs[t.clubKey];
    let team;
    try {
      const r = await pool.query(`
        INSERT INTO teams (club_id, division_id, name) VALUES ($1, $2, $3) RETURNING *
      `, [club.id, div.id, t.name]);
      team = r.rows[0];
    } catch {
      const r = await pool.query(
        `SELECT * FROM teams WHERE club_id=$1 AND name=$2`, [club.id, t.name]);
      team = r.rows[0];
    }
    teams[t.clubKey] = team;
    console.log(`[team] ${team.name}`);
  }

  // Players (11 total)
  const playerDefs = [
    // Estelares ENABLED (4)
    { first: 'Pedro',   last: 'Sánchez',  doc: '30100001', team: 'EST', status: 'ENABLED'  },
    { first: 'Juan',    last: 'Pérez',    doc: '30100002', team: 'EST', status: 'ENABLED'  },
    { first: 'Carlos',  last: 'Gómez',    doc: '30100003', team: 'EST', status: 'ENABLED'  },
    { first: 'Martín',  last: 'López',    doc: '30100004', team: 'EST', status: 'ENABLED'  },
    // Estelares DISABLED (1) — for demo of rejection
    { first: 'Roberto', last: 'Díaz',     doc: '30100005', team: 'EST', status: 'DISABLED' },
    // Rival ENABLED (4)
    { first: 'Diego',   last: 'Torres',   doc: '30200001', team: 'RIV', status: 'ENABLED'  },
    { first: 'Nicolás', last: 'Ruiz',     doc: '30200002', team: 'RIV', status: 'ENABLED'  },
    { first: 'Andrés',  last: 'Vega',     doc: '30200003', team: 'RIV', status: 'ENABLED'  },
    { first: 'Santiago',last: 'Mora',     doc: '30200004', team: 'RIV', status: 'ENABLED'  },
    // Tercer Club ENABLED — not in match
    { first: 'Felipe',  last: 'Castro',   doc: '30300001', team: 'TER', status: 'ENABLED'  },
    { first: 'Luciano', last: 'Herrera',  doc: '30300002', team: 'TER', status: 'ENABLED'  },
  ];

  console.log('\nPlayers:');
  for (const pd of playerDefs) {
    const secret = qrSecret();
    const { rows: [player] } = await pool.query(`
      INSERT INTO players (first_name, last_name, document_type, document_number, qr_secret)
      VALUES ($1, $2, 'DNI', $3, $4)
      ON CONFLICT (document_type, document_number)
        WHERE document_type IS NOT NULL AND document_number IS NOT NULL AND deleted_at IS NULL
        DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name
      RETURNING *
    `, [pd.first, pd.last, pd.doc, secret]);

    const team = teams[pd.team];
    await pool.query(`
      INSERT INTO player_registrations (player_id, team_id, season_id, status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (player_id, team_id, season_id) DO UPDATE SET status = EXCLUDED.status
    `, [player.id, team.id, season.id, pd.status]);

    console.log(`  ${player.first_name} ${player.last_name} → ${pd.team} [${pd.status}] (id: ${player.id})`);
  }

  // Match
  console.log('\nMatch:');
  const { rows: [matchRow] } = await pool.query(`
    INSERT INTO matches (association_id, home_team_id, away_team_id, season_id, scheduled_at, venue, status)
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '2 hours', 'Cancha Central Demo', 'SCHEDULED')
    RETURNING *
  `, [assoc.id, teams['EST'].id, teams['RIV'].id, season.id]);
  console.log(`  Estelares Primera vs Rival Primera (id: ${matchRow.id})`);

  // Operators
  console.log('\nOperators:');
  const opDefs = [
    { username: 'assoc_admin', password: 'assocadmin123', role: 'ADMIN' },
    { username: 'operador',    password: 'operador123',   role: 'OPERATOR' },
  ];
  for (const op of opDefs) {
    const hash = await bcrypt.hash(op.password, 10);
    await pool.query(`
      INSERT INTO association_operators (association_id, username, password_hash, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
    `, [assoc.id, op.username, hash, op.role]);
    console.log(`  ${op.username} (${op.role})`);
  }

  console.log('\n✅ Seed completado\n');
  console.log('Credenciales de acceso:');
  console.log('  Admin:    assoc_admin / assocadmin123');
  console.log('  Operador: operador / operador123');
  console.log('\nURL demo: /assoc/login');
  console.log('Para QRs de carnet: GET /api/assoc/players/:id/carnet-qr (con token de admin)');
  await pool.end();
}

seed().catch(err => { console.error('\n❌', err.message); pool.end(); process.exit(1); });
