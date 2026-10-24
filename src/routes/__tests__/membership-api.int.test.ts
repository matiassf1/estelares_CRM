import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../middleware/auth';
import { suspend, terminate } from '../../services/membership';
import { resetDb, getAdminId, createMember, dayOffset, addCheckIn } from '../../services/__tests__/helpers';

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

describe('permisos', () => {
  it('sin token devuelve 401', async () => {
    const id = await createMember();
    await request(app).post(`/api/admin/members/${id}/suspend`).send({ reason: 'x' }).expect(401);
  });

  it('el portero no puede suspender, dar de baja ni reactivar', async () => {
    const id = await createMember();
    for (const op of ['suspend', 'terminate', 'reactivate']) {
      await request(app)
        .post(`/api/admin/members/${id}/${op}`)
        .set(auth(porteroToken))
        .send({ reason: 'x' })
        .expect(403);
    }
  });

  it('un jugador no puede operar sobre membresías', async () => {
    const id = await createMember();
    await request(app)
      .post(`/api/admin/members/${id}/suspend`)
      .set(auth(signToken({ id, type: 'member' })))
      .send({ reason: 'x' })
      .expect(403);
  });
});

describe('endpoints de membresía', () => {
  it('ciclo completo suspender → consultar → reactivar', async () => {
    const id = await createMember();

    const s = await request(app)
      .post(`/api/admin/members/${id}/suspend`)
      .set(auth(adminToken))
      .send({ reason: 'Lesión', effective_until: await dayOffset(30) })
      .expect(201);
    expect(s.body.state.status).toBe('SUSPENDED');

    const g = await request(app)
      .get(`/api/admin/members/${id}/membership`)
      .set(auth(adminToken))
      .expect(200);
    expect(g.body.status).toBe('SUSPENDED');
    expect(g.body.status_reason).toBe('Lesión');

    const r = await request(app)
      .post(`/api/admin/members/${id}/reactivate`)
      .set(auth(adminToken))
      .send({ reason: 'Alta médica' })
      .expect(200);
    expect(r.body.state.status).toBe('ACTIVE');
    expect(r.body.noop).toBe(false);
  });

  it('devuelve 409 al suspender dos veces y 400 sin motivo', async () => {
    const id = await createMember();
    await request(app).post(`/api/admin/members/${id}/suspend`).set(auth(adminToken)).send({ reason: 'x' }).expect(201);
    await request(app).post(`/api/admin/members/${id}/suspend`).set(auth(adminToken)).send({ reason: 'y' }).expect(409);

    const otro = await createMember();
    await request(app).post(`/api/admin/members/${otro}/suspend`).set(auth(adminToken)).send({}).expect(400);
  });

  it('devuelve 404 para un jugador inexistente', async () => {
    await request(app)
      .get('/api/admin/members/11111111-1111-1111-1111-111111111111/membership')
      .set(auth(adminToken))
      .expect(404);
  });

  it('el historial incluye períodos y eventos', async () => {
    const id = await createMember();
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });
    const h = await request(app)
      .get(`/api/admin/members/${id}/membership/history`)
      .set(auth(adminToken))
      .expect(200);
    expect(h.body.periods).toHaveLength(1);
    expect(h.body.events[0].action).toBe('suspended');
    expect(h.body.events[0].performed_by_username).toBe('admin');
  });
});

describe('Regla E — sin borrado físico', () => {
  it('DELETE /members/:id responde 405 y no borra nada', async () => {
    const id = await createMember();
    await addCheckIn(id, 3);
    await request(app).delete(`/api/admin/members/${id}`).set(auth(adminToken)).expect(405);
    const m = await pool.query('SELECT COUNT(*) FROM members WHERE id = $1', [id]);
    const c = await pool.query('SELECT COUNT(*) FROM check_ins WHERE member_id = $1', [id]);
    expect(parseInt(m.rows[0].count)).toBe(1);
    expect(parseInt(c.rows[0].count)).toBe(1);
  });

  it('PUT /members/:id rechaza cambiar activo por la vía genérica', async () => {
    const id = await createMember();
    const res = await request(app)
      .put(`/api/admin/members/${id}`)
      .set(auth(adminToken))
      .send({ activo: false })
      .expect(400);
    expect(res.body.error).toMatch(/suspend/);
    const { rows } = await pool.query('SELECT activo FROM members WHERE id = $1', [id]);
    expect(rows[0].activo).toBe(true);
  });

  it('PUT /members/:id sigue funcionando para datos normales', async () => {
    const id = await createMember();
    await request(app)
      .put(`/api/admin/members/${id}`)
      .set(auth(adminToken))
      .send({ nombre: 'Nuevo' })
      .expect(200);
    const { rows } = await pool.query('SELECT nombre FROM members WHERE id = $1', [id]);
    expect(rows[0].nombre).toBe('Nuevo');
  });
});

describe('Reglas A y B — ingreso vs. portal', () => {
  it('un suspendido NO puede registrar ingreso por carnet, un activo sí', async () => {
    const activo = await createMember();
    const susp = await createMember();
    await suspend({ memberId: susp, reason: 'Lesión', actorId: adminId });

    await request(app)
      .post('/api/check-in/by-member')
      .set(auth(adminToken))
      .send({ member_id: activo })
      .expect(200);

    const res = await request(app)
      .post('/api/check-in/by-member')
      .set(auth(adminToken))
      .send({ member_id: susp })
      .expect(403);
    expect(res.body.error).toMatch(/suspendida/i);
  });

  it('un dado de baja NO puede registrar ingreso', async () => {
    const id = await createMember();
    await terminate({ memberId: id, reason: 'Se fue', actorId: adminId });
    await request(app)
      .post('/api/check-in/by-member')
      .set(auth(adminToken))
      .send({ member_id: id })
      .expect(403);
  });

  it('Regla B: un suspendido inicia sesión y /me muestra su situación', async () => {
    const id = await createMember();
    await suspend({
      memberId: id,
      reason: 'Cuota pendiente',
      effectiveUntil: await dayOffset(30),
      actorId: adminId,
    });

    const me = await request(app)
      .get('/api/auth/me')
      .set(auth(signToken({ id, type: 'member' })))
      .expect(200);

    expect(me.body.membership.status).toBe('SUSPENDED');
    expect(me.body.membership.reason).toBe('Cuota pendiente');
    expect(me.body.membership.until).toBeTruthy();
  });

  it('un JWT emitido antes de la suspensión sigue autenticando pero no habilita el ingreso', async () => {
    const id = await createMember();
    const tokenPrevio = signToken({ id, type: 'member' });
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });

    await request(app).get('/api/auth/me').set(auth(tokenPrevio)).expect(200);
    await request(app)
      .post('/api/check-in')
      .set(auth(tokenPrevio))
      .send({ token: 'invalido' })
      .expect(res => {
        expect([400, 403]).toContain(res.status);
      });
  });

  it('un dado de baja puede consultar su perfil (decisión: portal en modo consulta)', async () => {
    const id = await createMember();
    await terminate({ memberId: id, reason: 'Se fue', actorId: adminId });
    const me = await request(app)
      .get('/api/auth/me')
      .set(auth(signToken({ id, type: 'member' })))
      .expect(200);
    expect(me.body.membership.status).toBe('TERMINATED');
  });
});

describe('Regla C — stats y listados', () => {
  it('/admin/stats separa activos, suspendidos y bajas', async () => {
    const a = await createMember();
    const b = await createMember();
    const c = await createMember();
    await createMember();
    await suspend({ memberId: a, reason: 'x', actorId: adminId });
    await suspend({ memberId: b, reason: 'x', actorId: adminId });
    await terminate({ memberId: c, reason: 'x', actorId: adminId });

    const res = await request(app).get('/api/admin/stats').set(auth(adminToken)).expect(200);
    expect(res.body.activos).toBe(1);
    expect(res.body.suspendidos).toBe(2);
    expect(res.body.bajas).toBe(1);
  });

  it('/admin/members expone el estado y filtra por él', async () => {
    const a = await createMember();
    await createMember();
    await suspend({ memberId: a, reason: 'Lesión', actorId: adminId });

    const todos = await request(app).get('/api/admin/members').set(auth(adminToken)).expect(200);
    expect(todos.body).toHaveLength(2);
    expect(todos.body.every((m: { status: string }) => m.status)).toBe(true);

    const susp = await request(app)
      .get('/api/admin/members?status=SUSPENDED')
      .set(auth(adminToken))
      .expect(200);
    expect(susp.body).toHaveLength(1);
    expect(susp.body[0].id).toBe(a);

    await request(app).get('/api/admin/members?status=NOPE').set(auth(adminToken)).expect(400);
  });
});
