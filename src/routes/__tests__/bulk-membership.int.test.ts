import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../middleware/auth';
import { suspend, terminate, getMembershipState } from '../../services/membership';
import { resetDb, getAdminId, createMember, auditActions } from '../../services/__tests__/helpers';

const app = createApp();
let adminId: string;
let adminToken: string;
let porteroToken: string;

beforeEach(async () => {
  await resetDb();
  adminId = await getAdminId();
  adminToken = signToken({ id: adminId, type: 'admin' });
  const { rows } = await pool.query(`SELECT id FROM admins WHERE role = 'portero' LIMIT 1`);
  porteroToken = signToken({ id: rows[0].id, type: 'portero' });
});

afterAll(async () => {
  await pool.end();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const status = (id: string) => getMembershipState(id).then(s => s.status);

describe('lote: suspender', () => {
  it('suspende 3 jugadores y deja 3 entradas de auditoría', async () => {
    const ids = [await createMember(), await createMember(), await createMember()];

    const res = await request(app)
      .post('/api/admin/members/bulk/suspend')
      .set(auth(adminToken))
      .send({ member_ids: ids, reason: 'Cuota pendiente' })
      .expect(200);

    expect(res.body.applied).toBe(3);
    for (const id of ids) {
      expect(await status(id)).toBe('SUSPENDED');
      expect(await auditActions(id)).toEqual(['suspended']);
    }
  });

  it('ATOMICIDAD: si uno ya está suspendido, nadie cambia de estado', async () => {
    const a = await createMember();
    const b = await createMember({ apellido: 'Yaestaba' });
    const c = await createMember();
    await suspend({ memberId: b, reason: 'Lesión', actorId: adminId });

    await request(app)
      .post('/api/admin/members/bulk/suspend')
      .set(auth(adminToken))
      .send({ member_ids: [a, b, c], reason: 'Cuota' })
      .expect(409);

    expect(await status(a)).toBe('ACTIVE');
    expect(await status(b)).toBe('SUSPENDED');
    expect(await status(c)).toBe('ACTIVE');
    expect(await auditActions(a)).toEqual([]);
    expect(await auditActions(c)).toEqual([]);
  });

  it('el 409 nombra al jugador en conflicto', async () => {
    const a = await createMember();
    const b = await createMember({ nombre: 'Rodolfo', apellido: 'Pizarro' });
    await suspend({ memberId: b, reason: 'Lesión', actorId: adminId });

    const res = await request(app)
      .post('/api/admin/members/bulk/suspend')
      .set(auth(adminToken))
      .send({ member_ids: [a, b], reason: 'Cuota' })
      .expect(409);

    expect(JSON.stringify(res.body)).toMatch(/Pizarro/);
  });

  it('un id inexistente devuelve 404 y no cambia nada', async () => {
    const a = await createMember();
    await request(app)
      .post('/api/admin/members/bulk/suspend')
      .set(auth(adminToken))
      .send({ member_ids: [a, '11111111-1111-1111-1111-111111111111'], reason: 'x' })
      .expect(404);
    expect(await status(a)).toBe('ACTIVE');
  });

  it('lista vacía devuelve 400', async () => {
    await request(app)
      .post('/api/admin/members/bulk/suspend')
      .set(auth(adminToken))
      .send({ member_ids: [], reason: 'x' })
      .expect(400);
  });

  it('ids duplicados se aplican una sola vez', async () => {
    const a = await createMember();
    const res = await request(app)
      .post('/api/admin/members/bulk/suspend')
      .set(auth(adminToken))
      .send({ member_ids: [a, a, a], reason: 'x' })
      .expect(200);

    expect(res.body.applied).toBe(1);
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM membership_periods WHERE member_id = $1',
      [a]
    );
    expect(rows[0].n).toBe(1);
    expect(await auditActions(a)).toEqual(['suspended']);
  });
});

describe('lote: baja y reactivación', () => {
  it('la baja en lote libera las cocheras de todos', async () => {
    const a = await createMember();
    const b = await createMember();
    await pool.query(`INSERT INTO parking_spots (spot_number, member_id) VALUES ('L-01', $1)`, [a]);
    await pool.query(`INSERT INTO parking_spots (spot_number, member_id) VALUES ('L-02', $1)`, [b]);

    await request(app)
      .post('/api/admin/members/bulk/terminate')
      .set(auth(adminToken))
      .send({ member_ids: [a, b], reason: 'Se fueron' })
      .expect(200);

    const { rows } = await pool.query(
      `SELECT spot_number, member_id FROM parking_spots ORDER BY spot_number`
    );
    expect(rows.map(r => r.member_id)).toEqual([null, null]);
    expect(await status(a)).toBe('TERMINATED');
    expect(await status(b)).toBe('TERMINATED');
  });

  it('reactivar un lote con alguien ya activo no falla', async () => {
    const a = await createMember();
    const b = await createMember();
    const activo = await createMember();
    await terminate({ memberId: a, reason: 'x', actorId: adminId });
    await suspend({ memberId: b, reason: 'x', actorId: adminId });

    const res = await request(app)
      .post('/api/admin/members/bulk/reactivate')
      .set(auth(adminToken))
      .send({ member_ids: [a, b, activo], reason: 'Vuelven' })
      .expect(200);

    expect(res.body.applied).toBe(2);
    expect(await status(a)).toBe('ACTIVE');
    expect(await status(b)).toBe('ACTIVE');
    expect(await status(activo)).toBe('ACTIVE');
    expect(await auditActions(activo)).toEqual([]);
  });
});

describe('lote: permisos y ruteo', () => {
  it('sin token devuelve 401 y el portero 403', async () => {
    const a = await createMember();
    await request(app)
      .post('/api/admin/members/bulk/suspend')
      .send({ member_ids: [a], reason: 'x' })
      .expect(401);
    await request(app)
      .post('/api/admin/members/bulk/suspend')
      .set(auth(porteroToken))
      .send({ member_ids: [a], reason: 'x' })
      .expect(403);
  });

  it("'bulk' no se interpreta como :id de /members/:id/suspend", async () => {
    const a = await createMember();
    // Si Express matcheara :id = 'bulk', el cuerpo (sin member_ids) daría 400
    // por motivo faltante o un error de UUID inválido, nunca un lote aplicado.
    const res = await request(app)
      .post('/api/admin/members/bulk/suspend')
      .set(auth(adminToken))
      .send({ member_ids: [a], reason: 'x' })
      .expect(200);
    expect(res.body.member_ids).toEqual([a]);
    expect(await status(a)).toBe('SUSPENDED');
  });
});
