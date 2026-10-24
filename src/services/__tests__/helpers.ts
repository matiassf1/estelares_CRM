import { pool } from '../../db';

export async function resetDb(): Promise<void> {
  // categorias va incluida: su `nombre` es UNIQUE, y sin limpiarla los tests que
  // crean una categoría fallan al reejecutarse sobre la misma base.
  await pool.query(`
    TRUNCATE membership_periods, audit_log, check_ins, parking_spots,
             training_schedules, categorias, members
    RESTART IDENTITY CASCADE
  `);
}

export async function getAdminId(): Promise<string> {
  const { rows } = await pool.query(`SELECT id FROM admins WHERE role = 'admin' LIMIT 1`);
  return rows[0].id;
}

let dniCounterSeed = 0;

export async function createMember(
  overrides: { nombre?: string; apellido?: string; createdAt?: string } = {}
): Promise<string> {
  dniCounterSeed += 1;
  const { rows } = await pool.query(
    `INSERT INTO members (nombre, apellido, dni, password_hash, created_at)
     VALUES ($1, $2, $3, 'x', COALESCE($4::timestamp, NOW() - INTERVAL '2 years'))
     RETURNING id`,
    [
      overrides.nombre || 'Test',
      overrides.apellido || `Jugador${dniCounterSeed}`,
      `DNI${Date.now()}${dniCounterSeed}`,
      overrides.createdAt || null,
    ]
  );
  return rows[0].id;
}

/** Fecha argentina de hoy desplazada N días, en formato YYYY-MM-DD. */
export async function dayOffset(days: number): Promise<string> {
  const { rows } = await pool.query(
    `SELECT CAST((NOW() - INTERVAL '3 hours') AS DATE) + $1::int AS d`,
    [days]
  );
  const d = rows[0].d as Date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export async function addCheckIn(memberId: string, daysAgo: number): Promise<void> {
  await pool.query(
    `INSERT INTO check_ins (member_id, checked_in_at, token_used)
     VALUES ($1, NOW() - ($2::int * INTERVAL '1 day'), 'test')
     ON CONFLICT DO NOTHING`,
    [memberId, daysAgo]
  );
}

export async function auditActions(memberId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT action FROM audit_log WHERE entity = 'member' AND entity_id = $1
     ORDER BY performed_at`,
    [memberId]
  );
  return rows.map(r => r.action);
}
