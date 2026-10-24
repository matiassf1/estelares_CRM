import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../middleware/auth';
import { suspend, terminate } from '../../services/membership';
import { resetDb, getAdminId, createMember, addCheckIn, dayOffset } from '../../services/__tests__/helpers';

const app = createApp();
let adminId: string;
let token: string;

beforeEach(async () => {
  await resetDb();
  adminId = await getAdminId();
  token = signToken({ id: adminId, type: 'admin' });
});

afterAll(async () => {
  await pool.end();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

async function range() {
  return { from: await dayOffset(-60), to: await dayOffset(0) };
}

async function overview() {
  const { from, to } = await range();
  const res = await request(app)
    .get(`/api/admin/analytics/overview?from=${from}&to=${to}`)
    .set(auth())
    .expect(200);
  return res.body;
}

describe('métricas de ACTIVIDAD — inmunes al estado administrativo actual', () => {
  it('suspender hoy NO borra los check-ins históricos de las series', async () => {
    const a = await createMember();
    const b = await createMember();
    await addCheckIn(a, 40);
    await addCheckIn(a, 30);
    await addCheckIn(b, 20);

    const antes = await overview();
    expect(antes.total_checkins).toBe(3);

    await suspend({ memberId: a, reason: 'Lesión', actorId: adminId });

    const despues = await overview();
    expect(despues.total_checkins).toBe(3);
    expect(despues.unique_members).toBe(2);
    expect(despues.by_day).toEqual(antes.by_day);
  });

  it('dar de baja tampoco altera la historia', async () => {
    const a = await createMember();
    await addCheckIn(a, 15);
    const antes = await overview();
    await terminate({ memberId: a, reason: 'Se fue', actorId: adminId });
    const despues = await overview();
    expect(despues.total_checkins).toBe(antes.total_checkins);
    expect(despues.by_day).toEqual(antes.by_day);
  });

  it('el heatmap de tráfico tampoco cambia', async () => {
    const a = await createMember();
    await addCheckIn(a, 10);
    const { from, to } = await range();
    const url = `/api/admin/analytics/traffic?from=${from}&to=${to}`;

    const antes = (await request(app).get(url).set(auth()).expect(200)).body;
    await suspend({ memberId: a, reason: 'x', actorId: adminId });
    const despues = (await request(app).get(url).set(auth()).expect(200)).body;

    expect(despues).toEqual(antes);
  });
});

describe('métricas de PADRÓN — reflejan el estado actual (Regla C)', () => {
  it('active_members excluye suspendidos y bajas', async () => {
    const a = await createMember();
    const b = await createMember();
    await createMember();
    await createMember();

    expect((await overview()).active_members).toBe(4);

    await suspend({ memberId: a, reason: 'x', actorId: adminId });
    expect((await overview()).active_members).toBe(3);

    await terminate({ memberId: b, reason: 'x', actorId: adminId });
    expect((await overview()).active_members).toBe(2);
  });

  it('una suspensión FUTURA todavía no descuenta del padrón', async () => {
    const a = await createMember();
    await createMember();
    await suspend({ memberId: a, effectiveFrom: await dayOffset(20), reason: 'Viaje', actorId: adminId });
    expect((await overview()).active_members).toBe(2);
  });

  it('un suspendido no figura como "activo sin actividad"', async () => {
    const a = await createMember();
    await addCheckIn(a, 200); // histórico, fuera del rango consultado
    const { from, to } = await range();

    const antes = (
      await request(app).get(`/api/admin/analytics/overview?from=${from}&to=${to}`).set(auth())
    ).body;
    expect(antes.inactive_members.map((m: { id: string }) => m.id)).toContain(a);

    await suspend({ memberId: a, reason: 'Lesión', actorId: adminId });

    const despues = (
      await request(app).get(`/api/admin/analytics/overview?from=${from}&to=${to}`).set(auth())
    ).body;
    expect(despues.inactive_members.map((m: { id: string }) => m.id)).not.toContain(a);
  });

  it('el denominador de asistencia por categoría excluye suspendidos', async () => {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nombre) VALUES ('TestCat') RETURNING id`
    );
    const catId = rows[0].id;
    const a = await createMember();
    const b = await createMember();
    await pool.query('UPDATE members SET categoria_id = $1 WHERE id = ANY($2::uuid[])', [
      catId,
      [a, b],
    ]);

    const { from, to } = await range();
    const url = `/api/admin/analytics/categories/${catId}?from=${from}&to=${to}`;

    expect((await request(app).get(url).set(auth()).expect(200)).body.active_members).toBe(2);
    await suspend({ memberId: a, reason: 'x', actorId: adminId });
    expect((await request(app).get(url).set(auth()).expect(200)).body.active_members).toBe(1);
  });
});

describe('regresión — sin suspensiones nada cambia', () => {
  it('la ficha individual conserva sus números y expone el estado', async () => {
    const a = await createMember();
    await addCheckIn(a, 5);
    await addCheckIn(a, 10);
    const { from, to } = await range();

    const res = await request(app)
      .get(`/api/admin/analytics/members/${a}?from=${from}&to=${to}`)
      .set(auth())
      .expect(200);

    expect(res.body.total_checkins).toBe(2);
    expect(res.body.member.status).toBe('ACTIVE');
  });

  it('suspender a un jugador no altera la ficha individual de otro', async () => {
    const a = await createMember();
    const b = await createMember();
    await addCheckIn(b, 5);
    const { from, to } = await range();
    const url = `/api/admin/analytics/members/${b}?from=${from}&to=${to}`;

    const antes = (await request(app).get(url).set(auth()).expect(200)).body;
    await suspend({ memberId: a, reason: 'x', actorId: adminId });
    const despues = (await request(app).get(url).set(auth()).expect(200)).body;

    expect(despues).toEqual(antes);
  });

  it('los endpoints de analytics responden 200 con la base poblada', async () => {
    const a = await createMember();
    await addCheckIn(a, 5);
    await suspend({ memberId: a, reason: 'x', actorId: adminId });
    const { from, to } = await range();

    for (const path of ['overview', 'traffic', 'insights']) {
      await request(app)
        .get(`/api/admin/analytics/${path}?from=${from}&to=${to}`)
        .set(auth())
        .expect(200);
    }
  });
});
