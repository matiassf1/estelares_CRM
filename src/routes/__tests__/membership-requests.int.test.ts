import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../middleware/auth';
import { suspend, terminate, getMembershipState } from '../../services/membership';
import { resetDb, getAdminId, createMember, dayOffset } from '../../services/__tests__/helpers';

const app = createApp();
let adminId: string;
let adminToken: string;

beforeEach(async () => {
  await resetDb();
  adminId = await getAdminId();
  adminToken = signToken({ id: adminId, type: 'admin' });
});

afterAll(async () => {
  await pool.end();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const asMember = (id: string) => auth(signToken({ id, type: 'member' }));

/** Crea una solicitud por la vía del portal del jugador, que es la única que existe. */
function postRequest(memberId: string, body: Record<string, unknown>) {
  return request(app)
    .post('/api/member/membership-request')
    .set(asMember(memberId))
    .send(body);
}

async function requestRow(id: string) {
  const { rows } = await pool.query('SELECT * FROM membership_requests WHERE id = $1', [id]);
  return rows[0];
}

describe('el jugador crea una solicitud', () => {
  it('una solicitud de baja NO cambia el estado del jugador', async () => {
    const id = await createMember();

    const res = await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(10),
      reason: 'Me mudo de ciudad',
    }).expect(201);

    expect(res.body.request.kind).toBe('TERMINATION');
    expect(res.body.request.status).toBe('PENDING');
    // Lo esencial de todo el módulo: pedir no es aplicar.
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
  });

  it('rechaza una segunda solicitud mientras hay una pendiente', async () => {
    const id = await createMember();
    await postRequest(id, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(5),
      reason: 'Viaje',
    }).expect(201);

    const res = await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(5),
      reason: 'Otra cosa',
    }).expect(409);
    expect(res.body.error).toMatch(/pendiente/i);
  });

  it('rechaza una fecha efectiva en el pasado', async () => {
    const id = await createMember();
    const res = await postRequest(id, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(-1),
      reason: 'Avisé el mes pasado',
    }).expect(400);
    expect(res.body.error).toMatch(/pasad|anterior|hoy/i);
  });

  it('rechaza una fecha más allá del tope de anticipación', async () => {
    const id = await createMember();
    await postRequest(id, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(200),
      reason: 'Muy a futuro',
    }).expect(400);
  });

  it('exige motivo y lo limita a 500 caracteres', async () => {
    const id = await createMember();
    await postRequest(id, { kind: 'SUSPENSION', effective_from: await dayOffset(1) }).expect(400);
    await postRequest(id, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(1),
      reason: 'x'.repeat(501),
    }).expect(400);
  });

  it('rechaza effective_until fuera de una suspensión', async () => {
    const id = await createMember();
    await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(1),
      effective_until: await dayOffset(30),
      reason: 'Baja con fecha de fin',
    }).expect(400);
  });

  it('un suspendido no puede pedir otra suspensión pero sí la reactivación', async () => {
    const id = await createMember();
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });

    const conflicto = await postRequest(id, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(1),
      reason: 'Otra más',
    }).expect(409);
    expect(conflicto.body.error).toMatch(/suspensión vigente/i);

    await postRequest(id, {
      kind: 'REACTIVATION',
      effective_from: await dayOffset(1),
      reason: 'Me recuperé',
    }).expect(201);
  });

  it('un dado de baja puede pedir la reactivación, no una suspensión', async () => {
    const id = await createMember();
    await terminate({ memberId: id, reason: 'Se fue', actorId: adminId });

    await postRequest(id, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(1),
      reason: 'No corresponde',
    }).expect(409);

    const res = await postRequest(id, {
      kind: 'REACTIVATION',
      effective_from: await dayOffset(1),
      reason: 'Quiero volver',
    }).expect(201);
    expect(res.body.request.kind).toBe('REACTIVATION');
  });

  it('un activo no puede pedir la reactivación', async () => {
    const id = await createMember();
    await postRequest(id, {
      kind: 'REACTIVATION',
      effective_from: await dayOffset(1),
      reason: 'Ya estoy activo',
    }).expect(409);
  });

  it('el member_id sale del token, nunca del body', async () => {
    const yo = await createMember();
    const otro = await createMember();
    const res = await postRequest(yo, {
      member_id: otro,
      kind: 'TERMINATION',
      effective_from: await dayOffset(1),
      reason: 'Intento de suplantación',
    }).expect(201);
    expect(res.body.request.member_id).toBe(yo);
  });
});

describe('consulta y cancelación por el jugador', () => {
  it('GET devuelve null sin pendientes y la solicitud cuando la hay', async () => {
    const id = await createMember();
    const vacio = await request(app)
      .get('/api/member/membership-request')
      .set(asMember(id))
      .expect(200);
    expect(vacio.body.request).toBeNull();

    await postRequest(id, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(2),
      reason: 'Viaje',
    }).expect(201);

    const lleno = await request(app)
      .get('/api/member/membership-request')
      .set(asMember(id))
      .expect(200);
    expect(lleno.body.request.status).toBe('PENDING');
  });

  it('cancelar la propia la deja CANCELLED y habilita crear otra', async () => {
    const id = await createMember();
    const creada = await postRequest(id, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(2),
      reason: 'Viaje',
    }).expect(201);

    await request(app)
      .delete(`/api/member/membership-request/${creada.body.request.id}`)
      .set(asMember(id))
      .expect(200);

    expect((await requestRow(creada.body.request.id)).status).toBe('CANCELLED');

    await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(2),
      reason: 'Me decidí',
    }).expect(201);
  });

  it('cancelar la solicitud de otro jugador devuelve 404', async () => {
    const duenio = await createMember();
    const ajeno = await createMember();
    const creada = await postRequest(duenio, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(2),
      reason: 'Viaje',
    }).expect(201);

    await request(app)
      .delete(`/api/member/membership-request/${creada.body.request.id}`)
      .set(asMember(ajeno))
      .expect(404);

    expect((await requestRow(creada.body.request.id)).status).toBe('PENDING');
  });
});

describe('bandeja del administrador', () => {
  it('aprobar una baja aplica la transición y deja trazabilidad completa', async () => {
    const id = await createMember();
    const creada = await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(0),
      reason: 'Me mudo',
    }).expect(201);
    const reqId = creada.body.request.id;

    const res = await request(app)
      .post(`/api/admin/membership-requests/${reqId}/approve`)
      .set(auth(adminToken))
      .send({ note: 'Aprobado' })
      .expect(200);
    expect(res.body.state.status).toBe('TERMINATED');

    const row = await requestRow(reqId);
    expect(row.status).toBe('APPROVED');
    expect(row.resolved_by).toBe(adminId);
    expect(row.resolution_note).toBe('Aprobado');
    expect(row.period_id).toBeTruthy();

    const { rows: periods } = await pool.query(
      'SELECT id, kind FROM membership_periods WHERE member_id = $1',
      [id]
    );
    expect(periods).toHaveLength(1);
    expect(periods[0].id).toBe(row.period_id);

    // Auditoría del jugador (la escribe terminateTx) y de la solicitud.
    const { rows: memberAudit } = await pool.query(
      `SELECT action FROM audit_log WHERE entity = 'member' AND entity_id = $1`,
      [id]
    );
    expect(memberAudit.map(r => r.action)).toContain('terminated');
    const { rows: reqAudit } = await pool.query(
      `SELECT action, new_value FROM audit_log WHERE entity = 'membership_request' AND entity_id = $1`,
      [reqId]
    );
    expect(reqAudit).toHaveLength(1);
    expect(reqAudit[0].action).toBe('approved');
  });

  it('modificar y aprobar: una baja se convierte en suspensión', async () => {
    const id = await createMember();
    const creada = await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(0),
      reason: 'Me voy',
    }).expect(201);

    const res = await request(app)
      .post(`/api/admin/membership-requests/${creada.body.request.id}/approve`)
      .set(auth(adminToken))
      .send({ kind: 'SUSPENSION', effective_until: await dayOffset(60), note: 'Mejor suspensión' })
      .expect(200);

    expect(res.body.state.status).toBe('SUSPENDED');
    const row = await requestRow(creada.body.request.id);
    expect(row.status).toBe('APPROVED');
    // El pedido original se conserva: es el hecho que el jugador declaró.
    expect(row.kind).toBe('TERMINATION');

    const { rows: audit } = await pool.query(
      `SELECT new_value FROM audit_log WHERE entity = 'membership_request' AND entity_id = $1`,
      [creada.body.request.id]
    );
    expect(audit[0].new_value.kind).toBe('SUSPENSION');
    expect(audit[0].new_value.requested_kind).toBe('TERMINATION');
  });

  it('aprobar dos veces la misma solicitud da 409 y no crea un segundo período', async () => {
    const id = await createMember();
    const creada = await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(0),
      reason: 'Me voy',
    }).expect(201);
    const url = `/api/admin/membership-requests/${creada.body.request.id}/approve`;

    await request(app).post(url).set(auth(adminToken)).send({}).expect(200);
    await request(app).post(url).set(auth(adminToken)).send({}).expect(409);

    const { rows } = await pool.query(
      'SELECT COUNT(*) FROM membership_periods WHERE member_id = $1',
      [id]
    );
    expect(parseInt(rows[0].count, 10)).toBe(1);
  });

  it('si la transición falla, la solicitud no queda aprobada', async () => {
    const id = await createMember();
    const creada = await postRequest(id, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(0),
      reason: 'Viaje',
    }).expect(201);

    // El admin lo suspende por su cuenta antes de resolver la bandeja.
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });

    await request(app)
      .post(`/api/admin/membership-requests/${creada.body.request.id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(409);

    expect((await requestRow(creada.body.request.id)).status).toBe('PENDING');
  });

  it('aprobar una baja libera la cochera', async () => {
    const id = await createMember();
    await pool.query(`INSERT INTO parking_spots (spot_number, member_id) VALUES ('C-21', $1)`, [id]);
    const creada = await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(0),
      reason: 'Me voy',
    }).expect(201);

    await request(app)
      .post(`/api/admin/membership-requests/${creada.body.request.id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(200);

    const { rows } = await pool.query(
      `SELECT member_id FROM parking_spots WHERE spot_number = 'C-21'`
    );
    expect(rows[0].member_id).toBeNull();
  });

  it('rechazar no cambia el estado del jugador y exige nota', async () => {
    const id = await createMember();
    const creada = await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(0),
      reason: 'Me voy',
    }).expect(201);
    const reqId = creada.body.request.id;

    await request(app)
      .post(`/api/admin/membership-requests/${reqId}/reject`)
      .set(auth(adminToken))
      .send({})
      .expect(400);

    await request(app)
      .post(`/api/admin/membership-requests/${reqId}/reject`)
      .set(auth(adminToken))
      .send({ note: 'Tenés cuotas impagas' })
      .expect(200);

    const row = await requestRow(reqId);
    expect(row.status).toBe('REJECTED');
    expect(row.resolution_note).toBe('Tenés cuotas impagas');
    expect((await getMembershipState(id)).status).toBe('ACTIVE');
    const { rows: periods } = await pool.query(
      'SELECT COUNT(*) FROM membership_periods WHERE member_id = $1',
      [id]
    );
    expect(parseInt(periods[0].count, 10)).toBe(0);
  });

  it('el listado trae los datos del jugador y su estado, y filtra por status', async () => {
    const { rows: cat } = await pool.query(
      `INSERT INTO categorias (nombre) VALUES ('Primera') RETURNING id`
    );
    const id = await createMember({ nombre: 'Ana', apellido: 'Lopez' });
    await pool.query(`UPDATE members SET categoria_id = $1, foto_url = 'f.jpg' WHERE id = $2`, [
      cat[0].id,
      id,
    ]);
    const creada = await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(0),
      reason: 'Me voy',
    }).expect(201);

    const lista = await request(app)
      .get('/api/admin/membership-requests?status=PENDING')
      .set(auth(adminToken))
      .expect(200);
    expect(lista.body.requests).toHaveLength(1);
    const r = lista.body.requests[0];
    expect(r.apellido).toBe('Lopez');
    expect(r.nombre).toBe('Ana');
    expect(r.dni).toBeTruthy();
    expect(r.foto_url).toBe('f.jpg');
    expect(r.categoria_nombre).toBe('Primera');
    expect(r.member_status).toBe('ACTIVE');

    await request(app)
      .post(`/api/admin/membership-requests/${creada.body.request.id}/reject`)
      .set(auth(adminToken))
      .send({ note: 'No' })
      .expect(200);

    const vacia = await request(app)
      .get('/api/admin/membership-requests?status=PENDING')
      .set(auth(adminToken))
      .expect(200);
    expect(vacia.body.requests).toHaveLength(0);
  });

  it('el admin puede retroactivar al aprobar aunque el jugador no pueda pedirlo', async () => {
    const id = await createMember();
    const creada = await postRequest(id, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(0),
      reason: 'Avisé',
    }).expect(201);

    const retro = await dayOffset(-15);
    await request(app)
      .post(`/api/admin/membership-requests/${creada.body.request.id}/approve`)
      .set(auth(adminToken))
      .send({ effective_from: retro })
      .expect(200);

    const { rows } = await pool.query(
      `SELECT effective_from FROM membership_periods WHERE member_id = $1`,
      [id]
    );
    expect(rows[0].effective_from.toISOString().slice(0, 10)).toBe(retro);
  });
});

describe('permisos', () => {
  it('un jugador no puede listar ni resolver solicitudes', async () => {
    const id = await createMember();
    const token = asMember(id);
    await request(app).get('/api/admin/membership-requests').set(token).expect(403);
    await request(app)
      .post('/api/admin/membership-requests/11111111-1111-1111-1111-111111111111/approve')
      .set(token)
      .send({})
      .expect(403);
    await request(app)
      .post('/api/admin/membership-requests/11111111-1111-1111-1111-111111111111/reject')
      .set(token)
      .send({ note: 'x' })
      .expect(403);
  });

  it('el admin no usa las rutas del portal del jugador', async () => {
    await request(app).get('/api/member/membership-request').set(auth(adminToken)).expect(403);
    await request(app)
      .post('/api/member/membership-request')
      .set(auth(adminToken))
      .send({ kind: 'TERMINATION', effective_from: await dayOffset(1), reason: 'x' })
      .expect(403);
  });

  it('sin token devuelve 401', async () => {
    await request(app).get('/api/member/membership-request').expect(401);
  });
});

describe('contador del Inicio', () => {
  it('pendientes.solicitudes cuenta sólo las PENDING', async () => {
    const vacio = await request(app)
      .get('/api/admin/dashboard')
      .set(auth(adminToken))
      .expect(200);
    expect(vacio.body.pendientes.solicitudes).toBe(0);

    const a = await createMember();
    const b = await createMember();
    await postRequest(a, {
      kind: 'TERMINATION',
      effective_from: await dayOffset(1),
      reason: 'x',
    }).expect(201);
    const deB = await postRequest(b, {
      kind: 'SUSPENSION',
      effective_from: await dayOffset(1),
      reason: 'y',
    }).expect(201);

    const dos = await request(app).get('/api/admin/dashboard').set(auth(adminToken)).expect(200);
    expect(dos.body.pendientes.solicitudes).toBe(2);

    await request(app)
      .post(`/api/admin/membership-requests/${deB.body.request.id}/reject`)
      .set(auth(adminToken))
      .send({ note: 'No' })
      .expect(200);

    const una = await request(app).get('/api/admin/dashboard').set(auth(adminToken)).expect(200);
    expect(una.body.pendientes.solicitudes).toBe(1);
  });
});
