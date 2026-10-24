import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { pool } from '../../db';
import {
  suspend,
  terminate,
  reactivate,
  cancelPeriod,
  getMembershipState,
  getMembershipHistory,
  assertCanCheckIn,
  MembershipError,
} from '../membership';
import {
  resetDb,
  getAdminId,
  createMember,
  dayOffset,
  addCheckIn,
  auditActions,
} from './helpers';

let adminId: string;

beforeEach(async () => {
  await resetDb();
  adminId = await getAdminId();
});

afterAll(async () => {
  await pool.end();
});

describe('estado derivado', () => {
  it('un jugador sin períodos está ACTIVE', async () => {
    const id = await createMember();
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
  });

  it('una suspensión inmediata indefinida deja SUSPENDED', async () => {
    const id = await createMember();
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });
    const state = await getMembershipState(id);
    expect(state.status).toBe('SUSPENDED');
    expect(state.status_until).toBeNull();
    expect(state.status_reason).toBe('Lesión');
  });

  it('una suspensión FUTURA no afecta el estado de hoy', async () => {
    const id = await createMember();
    await suspend({
      memberId: id,
      effectiveFrom: await dayOffset(10),
      reason: 'Viaje programado',
      actorId: adminId,
    });
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
  });

  it('una suspensión VENCIDA deja de aplicar sola, sin proceso programado', async () => {
    const id = await createMember();
    await suspend({
      memberId: id,
      effectiveFrom: await dayOffset(-30),
      effectiveUntil: await dayOffset(-5),
      reason: 'Licencia',
      actorId: adminId,
    });
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
  });

  it('el intervalo es semiabierto: el día de effective_until ya está activo', async () => {
    const id = await createMember();
    const hoy = await dayOffset(0);
    await suspend({
      memberId: id,
      effectiveFrom: await dayOffset(-10),
      effectiveUntil: hoy,
      reason: 'Licencia',
      actorId: adminId,
    });
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
  });

  it('una suspensión vigente con fin futuro aplica hoy', async () => {
    const id = await createMember();
    await suspend({
      memberId: id,
      effectiveFrom: await dayOffset(-10),
      effectiveUntil: await dayOffset(10),
      reason: 'Licencia',
      actorId: adminId,
    });
    expect((await getMembershipState(id)).status).toBe('SUSPENDED');
  });
});

describe('transiciones inválidas e idempotencia', () => {
  it('suspender a un suspendido devuelve 409 sin crear otro período', async () => {
    const id = await createMember();
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });
    await expect(suspend({ memberId: id, reason: 'Otra vez', actorId: adminId })).rejects.toThrow(
      MembershipError
    );
    const { rows } = await pool.query(
      'SELECT COUNT(*) FROM membership_periods WHERE member_id = $1',
      [id]
    );
    expect(parseInt(rows[0].count)).toBe(1);
  });

  it('suspender a un dado de baja exige reactivar primero', async () => {
    const id = await createMember();
    await terminate({ memberId: id, reason: 'Se fue', actorId: adminId });
    await expect(suspend({ memberId: id, reason: 'x', actorId: adminId })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('dar de baja dos veces devuelve 409', async () => {
    const id = await createMember();
    await terminate({ memberId: id, reason: 'Se fue', actorId: adminId });
    await expect(terminate({ memberId: id, reason: 'otra', actorId: adminId })).rejects.toMatchObject(
      { status: 409 }
    );
  });

  it('reactivar a un activo es no-op idempotente', async () => {
    const id = await createMember();
    const r1 = await reactivate({ memberId: id, actorId: adminId });
    const r2 = await reactivate({ memberId: id, actorId: adminId });
    expect(r1.noop).toBe(true);
    expect(r2.noop).toBe(true);
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
  });

  it('el motivo es obligatorio para suspender y para dar de baja', async () => {
    const id = await createMember();
    await expect(suspend({ memberId: id, reason: '  ', actorId: adminId })).rejects.toMatchObject({
      status: 400,
    });
    await expect(terminate({ memberId: id, reason: '', actorId: adminId })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rechaza retroactividad mayor al máximo admitido', async () => {
    const id = await createMember();
    await expect(
      suspend({ memberId: id, effectiveFrom: await dayOffset(-120), reason: 'x', actorId: adminId })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rechaza una fecha efectiva anterior al alta del jugador', async () => {
    const id = await createMember({ createdAt: await dayOffset(-10) });
    await expect(
      suspend({ memberId: id, effectiveFrom: await dayOffset(-30), reason: 'x', actorId: adminId })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rechaza effective_until anterior o igual a effective_from', async () => {
    const id = await createMember();
    const hoy = await dayOffset(0);
    await expect(
      suspend({ memberId: id, effectiveFrom: hoy, effectiveUntil: hoy, reason: 'x', actorId: adminId })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('solapamientos', () => {
  it('la base rechaza dos suspensiones que se superponen', async () => {
    const id = await createMember();
    await suspend({
      memberId: id,
      effectiveFrom: await dayOffset(5),
      effectiveUntil: await dayOffset(20),
      reason: 'Primera',
      actorId: adminId,
    });
    await expect(
      pool.query(
        `INSERT INTO membership_periods (member_id, kind, effective_from, effective_until, reason, created_by)
         VALUES ($1, 'SUSPENSION', $2, $3, 'Segunda', $4)`,
        [id, await dayOffset(10), await dayOffset(25), adminId]
      )
    ).rejects.toMatchObject({ code: '23P01' });
  });

  it('acepta suspensiones consecutivas que se tocan en el borde', async () => {
    const id = await createMember();
    const a = await dayOffset(5);
    const b = await dayOffset(15);
    const c = await dayOffset(25);
    await suspend({ memberId: id, effectiveFrom: a, effectiveUntil: b, reason: 'P1', actorId: adminId });
    await expect(
      pool.query(
        `INSERT INTO membership_periods (member_id, kind, effective_from, effective_until, reason, created_by)
         VALUES ($1, 'SUSPENSION', $2, $3, 'P2', $4)`,
        [id, b, c, adminId]
      )
    ).resolves.toBeTruthy();
  });

  it('un período cancelado libera el rango', async () => {
    const id = await createMember();
    const p = await suspend({
      memberId: id,
      effectiveFrom: await dayOffset(5),
      effectiveUntil: await dayOffset(20),
      reason: 'Error de carga',
      actorId: adminId,
    });
    await cancelPeriod(p.id, adminId, 'Cargada por error');
    await expect(
      suspend({
        memberId: id,
        effectiveFrom: await dayOffset(5),
        effectiveUntil: await dayOffset(20),
        reason: 'Correcta',
        actorId: adminId,
      })
    ).resolves.toBeTruthy();
  });

  it('dos bajas concurrentes producen una sola', async () => {
    const id = await createMember();
    const results = await Promise.allSettled([
      terminate({ memberId: id, reason: 'A', actorId: adminId }),
      terminate({ memberId: id, reason: 'B', actorId: adminId }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM membership_periods
       WHERE member_id = $1 AND kind = 'TERMINATION' AND cancelled_at IS NULL`,
      [id]
    );
    expect(parseInt(rows[0].count)).toBe(1);
  });
});

describe('reactivación (Regla D)', () => {
  it('conserva identidad, antigüedad, categoría y check-ins', async () => {
    const id = await createMember();
    await addCheckIn(id, 30);
    await addCheckIn(id, 20);
    const before = await pool.query('SELECT created_at, categoria_id FROM members WHERE id = $1', [id]);

    await terminate({ memberId: id, reason: 'Se fue del club', actorId: adminId });
    await reactivate({ memberId: id, reason: 'Volvió', actorId: adminId });

    const after = await pool.query('SELECT created_at, categoria_id FROM members WHERE id = $1', [id]);
    const checkins = await pool.query('SELECT COUNT(*) FROM check_ins WHERE member_id = $1', [id]);

    expect(after.rows[0].created_at).toEqual(before.rows[0].created_at);
    expect(after.rows[0].categoria_id).toEqual(before.rows[0].categoria_id);
    expect(parseInt(checkins.rows[0].count)).toBe(2);
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
  });

  it('la reactivación anticipada cierra la suspensión en la fecha indicada', async () => {
    const id = await createMember();
    await suspend({
      memberId: id,
      effectiveFrom: await dayOffset(-10),
      effectiveUntil: await dayOffset(30),
      reason: 'Lesión',
      actorId: adminId,
    });
    const hoy = await dayOffset(0);
    const r = await reactivate({ memberId: id, effectiveFrom: hoy, actorId: adminId });

    expect(r.noop).toBe(false);
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
    const { rows } = await pool.query(
      'SELECT effective_until, closed_at FROM membership_periods WHERE id = $1',
      [r.closed_period_id]
    );
    expect(rows[0].closed_at).not.toBeNull();
  });

  it('reactivar antes del inicio cancela el período en vez de dejar un rango inválido', async () => {
    const id = await createMember();
    await suspend({
      memberId: id,
      effectiveFrom: await dayOffset(-10),
      reason: 'Lesión',
      actorId: adminId,
    });
    await reactivate({ memberId: id, effectiveFrom: await dayOffset(-20), actorId: adminId });
    const { rows } = await pool.query(
      'SELECT cancelled_at FROM membership_periods WHERE member_id = $1',
      [id]
    );
    expect(rows[0].cancelled_at).not.toBeNull();
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
  });

  it('después de reactivar se puede volver a suspender', async () => {
    const id = await createMember();
    await suspend({ memberId: id, effectiveFrom: await dayOffset(-20), reason: 'A', actorId: adminId });
    await reactivate({ memberId: id, effectiveFrom: await dayOffset(-10), actorId: adminId });
    await expect(suspend({ memberId: id, reason: 'B', actorId: adminId })).resolves.toBeTruthy();
    expect((await getMembershipState(id)).status).toBe('SUSPENDED');
  });
});

describe('baja y cochera (Reglas E y F)', () => {
  it('libera la cochera en la misma transacción y lo audita', async () => {
    const id = await createMember();
    await pool.query(`INSERT INTO parking_spots (spot_number, member_id) VALUES ('C-12', $1)`, [id]);

    await terminate({ memberId: id, reason: 'Se mudó', actorId: adminId });

    const { rows } = await pool.query(`SELECT member_id FROM parking_spots WHERE spot_number = 'C-12'`);
    expect(rows[0].member_id).toBeNull();

    const { rows: audit } = await pool.query(
      `SELECT old_value FROM audit_log WHERE action = 'released_on_termination'`
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].old_value.spot_number).toBe('C-12');
  });

  it('la baja sin cochera asignada no falla', async () => {
    const id = await createMember();
    await expect(terminate({ memberId: id, reason: 'x', actorId: adminId })).resolves.toBeTruthy();
  });

  it('la reactivación NO reasigna la cochera anterior', async () => {
    const id = await createMember();
    await pool.query(`INSERT INTO parking_spots (spot_number, member_id) VALUES ('C-07', $1)`, [id]);
    await terminate({ memberId: id, reason: 'x', actorId: adminId });
    await reactivate({ memberId: id, actorId: adminId });
    const { rows } = await pool.query(`SELECT member_id FROM parking_spots WHERE spot_number = 'C-07'`);
    expect(rows[0].member_id).toBeNull();
  });

  it('la baja NO elimina el jugador ni sus check-ins', async () => {
    const id = await createMember();
    await addCheckIn(id, 5);
    await terminate({ memberId: id, reason: 'x', actorId: adminId });
    const m = await pool.query('SELECT COUNT(*) FROM members WHERE id = $1', [id]);
    const c = await pool.query('SELECT COUNT(*) FROM check_ins WHERE member_id = $1', [id]);
    expect(parseInt(m.rows[0].count)).toBe(1);
    expect(parseInt(c.rows[0].count)).toBe(1);
  });

  it('la suspensión NO libera la cochera', async () => {
    const id = await createMember();
    await pool.query(`INSERT INTO parking_spots (spot_number, member_id) VALUES ('C-99', $1)`, [id]);
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });
    const { rows } = await pool.query(`SELECT member_id FROM parking_spots WHERE spot_number = 'C-99'`);
    expect(rows[0].member_id).toBe(id);
  });

  it('dar de baja a un suspendido cierra la suspensión vigente', async () => {
    const id = await createMember();
    await suspend({ memberId: id, effectiveFrom: await dayOffset(-10), reason: 'Lesión', actorId: adminId });
    await terminate({ memberId: id, reason: 'No vuelve', actorId: adminId });
    expect((await getMembershipState(id)).status).toBe('TERMINATED');
  });
});

describe('control de ingreso (Regla A)', () => {
  it('permite el ingreso a un activo', async () => {
    const id = await createMember();
    expect(() => assertCanCheckIn({ status: 'ACTIVE' } as never)).not.toThrow();
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
  });

  it('deniega el ingreso a un suspendido y a un dado de baja', () => {
    expect(() => assertCanCheckIn({ status: 'SUSPENDED' } as never)).toThrow(MembershipError);
    expect(() => assertCanCheckIn({ status: 'TERMINATED' } as never)).toThrow(MembershipError);
  });
});

describe('auditoría', () => {
  it('registra cada transición con autor y motivo', async () => {
    const id = await createMember();
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });
    await reactivate({ memberId: id, reason: 'Alta médica', actorId: adminId });
    await terminate({ memberId: id, reason: 'Se fue', actorId: adminId });

    expect(await auditActions(id)).toEqual(['suspended', 'reactivated', 'terminated']);

    const { rows } = await pool.query(
      `SELECT performed_by, performed_by_type, reason FROM audit_log
       WHERE entity = 'member' AND entity_id = $1 ORDER BY performed_at`,
      [id]
    );
    expect(rows[0].performed_by).toBe(adminId);
    expect(rows[0].performed_by_type).toBe('admin');
    expect(rows[0].reason).toBe('Lesión');
  });

  it('el historial devuelve períodos y eventos', async () => {
    const id = await createMember();
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });
    const h = await getMembershipHistory(id);
    expect(h.periods).toHaveLength(1);
    expect(h.events).toHaveLength(1);
    expect(h.periods[0].effective_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('una transición fallida no deja rastro parcial', async () => {
    const id = await createMember();
    await terminate({ memberId: id, reason: 'x', actorId: adminId });
    const before = (await auditActions(id)).length;
    await expect(suspend({ memberId: id, reason: 'y', actorId: adminId })).rejects.toThrow();
    expect((await auditActions(id)).length).toBe(before);
  });
});

describe('compatibilidad con members.activo', () => {
  it('activo refleja el estado derivado tras cada transición', async () => {
    const id = await createMember();
    const activo = async () =>
      (await pool.query('SELECT activo FROM members WHERE id = $1', [id])).rows[0].activo;

    expect(await activo()).toBe(true);
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });
    expect(await activo()).toBe(false);
    await reactivate({ memberId: id, actorId: adminId });
    expect(await activo()).toBe(true);
    await terminate({ memberId: id, reason: 'x', actorId: adminId });
    expect(await activo()).toBe(false);
  });

  it('una suspensión futura no desactiva al jugador todavía', async () => {
    const id = await createMember();
    await suspend({ memberId: id, effectiveFrom: await dayOffset(15), reason: 'Viaje', actorId: adminId });
    const { rows } = await pool.query('SELECT activo FROM members WHERE id = $1', [id]);
    expect(rows[0].activo).toBe(true);
  });
});
