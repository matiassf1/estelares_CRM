#!/usr/bin/env node
/**
 * Backfill de membership_periods a partir de members.activo.
 *
 * DELIBERADAMENTE FUERA DEL RUNNER DE MIGRACIONES: no debe ejecutarse solo en el
 * arranque de producción. Se corre a mano, una vez, después de revisar el
 * informe que imprime en modo --dry-run (el modo por defecto).
 *
 *   node scripts/backfill-membership.js            # informe, no escribe nada
 *   node scripts/backfill-membership.js --apply    # escribe
 *
 * CRITERIO: los `activo = false` se migran como SUSPENSION, NO como TERMINATION.
 * El motivo real de esas desactivaciones no quedó registrado en ningún lado, así
 * que clasificarlos como baja sería inventar un hecho administrativo que nunca
 * ocurrió. La suspensión es reversible, preserva exactamente el comportamiento
 * actual (sin ingreso, fuera del padrón activo) y queda marcada con
 * legacy_migrated = true para que el club la reclasifique caso por caso desde el
 * chip "Revisar" del panel.
 *
 * effective_from = fecha de ejecución, y no created_at: no sabemos cuándo se
 * desactivó a cada jugador, y poner una fecha inventada contaminaría cualquier
 * consulta histórica futura.
 */
require('dotenv/config');
const { Pool } = require('pg');

const APPLY = process.argv.includes('--apply');

const REASON =
  'Estado migrado automáticamente desde el sistema anterior. ' +
  'El motivo original no fue registrado. Requiere revisión administrativa.';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const { rows: pendientes } = await pool.query(`
    SELECT m.id, m.nombre, m.apellido, m.dni, m.created_at
    FROM members m
    WHERE m.activo = false
      AND NOT EXISTS (
        SELECT 1 FROM membership_periods mp
        WHERE mp.member_id = m.id AND mp.cancelled_at IS NULL
      )
    ORDER BY m.apellido, m.nombre
  `);

  const { rows: totales } = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE activo) AS activos,
           COUNT(*) FILTER (WHERE NOT activo) AS inactivos,
           COUNT(*) AS total
    FROM members
  `);

  console.log('\n── Padrón actual ──────────────────────────────');
  console.log(`  Total jugadores : ${totales[0].total}`);
  console.log(`  activo = true   : ${totales[0].activos}`);
  console.log(`  activo = false  : ${totales[0].inactivos}`);
  console.log(`\n  A migrar (sin período previo): ${pendientes.length}`);

  if (pendientes.length > 0) {
    console.log('\n── Jugadores que quedarán como SUSPENDIDOS (a revisar) ──');
    for (const p of pendientes) {
      console.log(`  · ${p.apellido}, ${p.nombre} (DNI ${p.dni}) — alta ${p.created_at.toISOString().slice(0, 10)}`);
    }
  }

  if (!APPLY) {
    console.log('\n[DRY RUN] No se escribió nada. Reejecutá con --apply para aplicar.\n');
    await pool.end();
    return;
  }

  if (pendientes.length === 0) {
    console.log('\nNada que migrar.\n');
    await pool.end();
    return;
  }

  const { rows: admins } = await pool.query(
    `SELECT id FROM admins WHERE role = 'admin' ORDER BY created_at LIMIT 1`
  );
  if (!admins[0]) {
    console.error('No hay ningún admin para atribuir la operación.');
    process.exit(1);
  }
  const actorId = admins[0].id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of pendientes) {
      const { rows } = await client.query(
        `INSERT INTO membership_periods
           (member_id, kind, effective_from, effective_until, reason, created_by, legacy_migrated)
         VALUES ($1, 'SUSPENSION', CAST((NOW() - INTERVAL '3 hours') AS DATE), NULL, $2, $3, true)
         RETURNING id`,
        [p.id, REASON, actorId]
      );
      await client.query(
        `INSERT INTO audit_log (entity, entity_id, action, old_value, new_value,
                                performed_by, performed_by_type, reason)
         VALUES ('member', $1, 'legacy_migrated', $2::jsonb, $3::jsonb, $4, 'admin', $5)`,
        [
          p.id,
          JSON.stringify({ activo: false }),
          JSON.stringify({ status: 'SUSPENDED', period_id: rows[0].id, needs_review: true }),
          actorId,
          REASON,
        ]
      );
    }
    await client.query('COMMIT');
    console.log(`\n✓ ${pendientes.length} jugadores migrados como SUSPENDIDOS (marcados para revisión).\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
