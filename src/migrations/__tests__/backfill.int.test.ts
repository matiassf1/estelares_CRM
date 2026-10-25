import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { pool } from '../../db';
import { getMembershipState } from '../../services/membership';
import { resetDb } from '../../services/__tests__/helpers';

/**
 * Verifica el backfill que viaja DENTRO de 004. Reejecuta el archivo de
 * migración tal cual se despliega: es idempotente (CREATE ... IF NOT EXISTS,
 * CREATE OR REPLACE VIEW, el DO que traga duplicate_object, y el INSERT guardado
 * por NOT EXISTS), así que correrlo de nuevo sobre una base ya migrada sólo
 * ejercita el backfill.
 */
const MIGRATION_SQL = fs.readFileSync(
  path.join(__dirname, '..', '004_membership_periods.sql'),
  'utf8'
);

const AUDIT_SQL = fs.readFileSync(
  path.join(__dirname, '..', '005_backfill_legacy_audit.sql'),
  'utf8'
);

async function createInactive(apellido: string, activo: boolean): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO members (nombre, apellido, dni, password_hash, activo)
     VALUES ('Test', $1, $2, 'x', $3) RETURNING id`,
    [apellido, `D${Date.now()}${Math.floor(Math.random() * 100000)}`, activo]
  );
  return rows[0].id;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('backfill de members.activo (migración 004)', () => {
  it('deja SUSPENDIDOS a los activo=false y no toca a los activos', async () => {
    const inactivoA = await createInactive('Inactivo A', false);
    const inactivoB = await createInactive('Inactivo B', false);
    const activo = await createInactive('Activo', true);

    await pool.query(MIGRATION_SQL);

    expect((await getMembershipState(inactivoA)).status).toBe('SUSPENDED');
    expect((await getMembershipState(inactivoB)).status).toBe('SUSPENDED');
    expect((await getMembershipState(activo)).status).toBe('ACTIVE');
  });

  it('los marca para revisión, nunca como baja', async () => {
    const id = await createInactive('Sin motivo', false);
    await pool.query(MIGRATION_SQL);

    const state = await getMembershipState(id);
    expect(state.needs_review).toBe(true);
    expect(state.status).not.toBe('TERMINATED');

    const { rows } = await pool.query(
      `SELECT kind, legacy_migrated, reason FROM membership_periods WHERE member_id = $1`,
      [id]
    );
    expect(rows[0].kind).toBe('SUSPENSION');
    expect(rows[0].legacy_migrated).toBe(true);
    expect(rows[0].reason).toMatch(/revisión/i);
  });

  it('no deja ninguna ventana: ningún activo=false queda ACTIVE tras migrar', async () => {
    for (let i = 0; i < 5; i++) await createInactive(`Lote ${i}`, false);
    await pool.query(MIGRATION_SQL);

    const { rows } = await pool.query(`
      SELECT COUNT(*) AS n FROM members m
      JOIN member_membership_state s ON s.member_id = m.id
      WHERE m.activo = false AND s.status = 'ACTIVE'
    `);
    expect(parseInt(rows[0].n)).toBe(0);
  });

  it('es idempotente: reejecutar la migración no duplica períodos', async () => {
    const id = await createInactive('Repetido', false);
    await pool.query(MIGRATION_SQL);
    await pool.query(MIGRATION_SQL);
    await pool.query(MIGRATION_SQL);

    const { rows } = await pool.query(
      'SELECT COUNT(*) AS n FROM membership_periods WHERE member_id = $1',
      [id]
    );
    expect(parseInt(rows[0].n)).toBe(1);
  });

  // 005 repara lo que 004 no escribía: los migrados quedaban sin rastro en
  // audit_log, y por lo tanto sin historial visible.
  it('005 deja auditados a los migrados por 004', async () => {
    const id = await createInactive('Sin auditar', false);
    await pool.query(MIGRATION_SQL);
    await pool.query(AUDIT_SQL);

    const { rows } = await pool.query(
      `SELECT action, reason, performed_by_type FROM audit_log
       WHERE entity = 'member' AND entity_id = $1`,
      [id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('legacy_migrated');
    expect(rows[0].performed_by_type).toBe('admin');
  });

  it('005 es idempotente', async () => {
    const id = await createInactive('Repetido audit', false);
    await pool.query(MIGRATION_SQL);
    await pool.query(AUDIT_SQL);
    await pool.query(AUDIT_SQL);
    await pool.query(AUDIT_SQL);

    const { rows } = await pool.query(
      `SELECT COUNT(*) AS n FROM audit_log WHERE entity='member' AND entity_id = $1`,
      [id]
    );
    expect(parseInt(rows[0].n)).toBe(1);
  });

  it('no pisa un período ya cargado a mano', async () => {
    const id = await createInactive('Ya tratado', false);
    const { rows: admins } = await pool.query(`SELECT id FROM admins LIMIT 1`);
    await pool.query(
      `INSERT INTO membership_periods (member_id, kind, effective_from, reason, created_by)
       VALUES ($1, 'TERMINATION', CAST((NOW() - INTERVAL '3 hours') AS DATE), 'Baja real', $2)`,
      [id, admins[0].id]
    );

    await pool.query(MIGRATION_SQL);

    const state = await getMembershipState(id);
    expect(state.status).toBe('TERMINATED');
    expect(state.needs_review).toBe(false);
  });
});
