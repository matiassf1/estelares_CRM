import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { pool } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../middleware/auth';
import { getAdminId } from '../../services/__tests__/helpers';

const app = createApp();
let adminId: string;
let adminToken: string;
let porteroToken: string;

/**
 * `resetDb()` NO trunca `admins`, y está bien que no lo haga: `initDb()` crea
 * los usuarios 'admin' y 'portero' una sola vez, al arrancar, y varios tests
 * dependen de que existan. Acá se limpia sólo lo que crea este archivo, que es
 * todo lo que no sean esos dos usuarios por defecto.
 */
async function cleanupCreatedUsers(): Promise<void> {
  await pool.query(`DELETE FROM admins WHERE username NOT IN ('admin', 'portero')`);
}

beforeEach(async () => {
  await cleanupCreatedUsers();
  adminId = await getAdminId();
  adminToken = signToken({ id: adminId, type: 'admin' });
  const { rows } = await pool.query(`SELECT id FROM admins WHERE role = 'portero' LIMIT 1`);
  porteroToken = signToken({ id: rows[0].id, type: 'portero' });
});

afterAll(async () => {
  await cleanupCreatedUsers();
  await pool.end();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const createUser = (body: Record<string, unknown>) =>
  request(app).post('/api/admin/users').set(auth(adminToken)).send(body);

describe('permisos', () => {
  it('sin token devuelve 401', async () => {
    await request(app).get('/api/admin/users').expect(401);
  });

  it('el portero no puede administrar usuarios', async () => {
    await request(app).get('/api/admin/users').set(auth(porteroToken)).expect(403);
    await request(app)
      .post('/api/admin/users')
      .set(auth(porteroToken))
      .send({ username: 'x', password: 'password1', role: 'portero' })
      .expect(403);
  });
});

describe('GET /api/admin/users', () => {
  it('lista los usuarios sin exponer nunca el password_hash', async () => {
    await createUser({ username: 'nuevo', password: 'password1', role: 'portero' }).expect(201);

    const res = await request(app).get('/api/admin/users').set(auth(adminToken)).expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(3);
    for (const u of res.body) {
      expect(u).not.toHaveProperty('password_hash');
      expect(Object.keys(u).sort()).toEqual(['created_at', 'id', 'role', 'username']);
    }
    // Defensa adicional: el hash no puede aparecer ni siquiera bajo otra clave.
    expect(JSON.stringify(res.body)).not.toContain('$2');
  });
});

describe('POST /api/admin/users', () => {
  it('crea un usuario, hashea la contraseña y no devuelve el hash', async () => {
    const res = await createUser({ username: 'portero2', password: 'password1', role: 'portero' })
      .expect(201);

    expect(res.body.username).toBe('portero2');
    expect(res.body.role).toBe('portero');
    expect(res.body).not.toHaveProperty('password_hash');

    const { rows } = await pool.query(
      'SELECT password_hash FROM admins WHERE username = $1',
      ['portero2']
    );
    expect(rows[0].password_hash).not.toBe('password1');
    expect(await bcrypt.compare('password1', rows[0].password_hash)).toBe(true);
  });

  it('rechaza un username duplicado con 409', async () => {
    await createUser({ username: 'repetido', password: 'password1', role: 'portero' }).expect(201);
    const res = await createUser({ username: 'repetido', password: 'password2', role: 'admin' })
      .expect(409);
    expect(res.body.error).toMatch(/usuario/i);
  });

  it('rechaza contraseñas de menos de 8 caracteres con 400', async () => {
    await createUser({ username: 'corto', password: 'corta12', role: 'portero' }).expect(400);
    const { rows } = await pool.query('SELECT 1 FROM admins WHERE username = $1', ['corto']);
    expect(rows).toHaveLength(0);
  });

  it('rechaza un rol distinto de admin o portero con 400', async () => {
    await createUser({ username: 'raro', password: 'password1', role: 'superadmin' }).expect(400);
  });

  it('exige username, password y role', async () => {
    await createUser({ password: 'password1', role: 'portero' }).expect(400);
    await createUser({ username: 'sinpass', role: 'portero' }).expect(400);
    await createUser({ username: 'sinrol', password: 'password1' }).expect(400);
  });
});

describe('PUT /api/admin/users/:id/password', () => {
  it('cambia la contraseña de otro usuario', async () => {
    const created = await createUser({ username: 'otro', password: 'password1', role: 'portero' })
      .expect(201);

    await request(app)
      .put(`/api/admin/users/${created.body.id}/password`)
      .set(auth(adminToken))
      .send({ password: 'nuevaclave1' })
      .expect(200);

    const { rows } = await pool.query('SELECT password_hash FROM admins WHERE id = $1', [
      created.body.id,
    ]);
    expect(await bcrypt.compare('nuevaclave1', rows[0].password_hash)).toBe(true);
  });

  it('rechaza una contraseña corta con 400', async () => {
    const created = await createUser({ username: 'otro2', password: 'password1', role: 'portero' })
      .expect(201);
    await request(app)
      .put(`/api/admin/users/${created.body.id}/password`)
      .set(auth(adminToken))
      .send({ password: 'corta12' })
      .expect(400);
  });

  it('devuelve 404 si el usuario no existe', async () => {
    await request(app)
      .put('/api/admin/users/00000000-0000-0000-0000-000000000000/password')
      .set(auth(adminToken))
      .send({ password: 'password1' })
      .expect(404);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('elimina un usuario', async () => {
    const created = await createUser({ username: 'borrable', password: 'password1', role: 'portero' })
      .expect(201);

    await request(app)
      .delete(`/api/admin/users/${created.body.id}`)
      .set(auth(adminToken))
      .expect(200);

    const { rows } = await pool.query('SELECT 1 FROM admins WHERE id = $1', [created.body.id]);
    expect(rows).toHaveLength(0);
  });

  it('NO permite borrar al último usuario con rol admin', async () => {
    // El 'admin' por defecto es el único con ese rol: borrarlo dejaría al club
    // sin forma de entrar al panel.
    const res = await request(app)
      .delete(`/api/admin/users/${adminId}`)
      .set(auth(adminToken))
      .expect(409);
    expect(res.body.error).toMatch(/admin/i);

    const { rows } = await pool.query(`SELECT 1 FROM admins WHERE role = 'admin'`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('permite borrar un admin cuando queda otro, operando como un tercero', async () => {
    const a = await createUser({ username: 'admin_a', password: 'password1', role: 'admin' })
      .expect(201);
    await createUser({ username: 'admin_b', password: 'password1', role: 'admin' }).expect(201);

    // El actor es el 'admin' por defecto, así que no es un borrado de uno mismo.
    await request(app).delete(`/api/admin/users/${a.body.id}`).set(auth(adminToken)).expect(200);

    const { rows } = await pool.query(`SELECT 1 FROM admins WHERE role = 'admin'`);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('NO permite borrarse a uno mismo', async () => {
    const yo = await createUser({ username: 'admin_yo', password: 'password1', role: 'admin' })
      .expect(201);
    const yoToken = signToken({ id: yo.body.id, type: 'admin' });

    const res = await request(app)
      .delete(`/api/admin/users/${yo.body.id}`)
      .set(auth(yoToken))
      .expect(409);
    expect(res.body.error).toMatch(/propio usuario/i);

    const { rows } = await pool.query('SELECT 1 FROM admins WHERE id = $1', [yo.body.id]);
    expect(rows).toHaveLength(1);
  });

  it('devuelve 404 si el usuario no existe', async () => {
    await request(app)
      .delete('/api/admin/users/00000000-0000-0000-0000-000000000000')
      .set(auth(adminToken))
      .expect(404);
  });
});
