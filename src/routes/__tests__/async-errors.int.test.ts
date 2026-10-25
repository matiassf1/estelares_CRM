// Express 4 no captura las excepciones lanzadas dentro de un handler async:
// la promesa rechazada no llega al error middleware, la request se cuelga y
// Node 22 mata el proceso por unhandledRejection. Estos tests rompen una
// tabla real para forzar una query real fallida contra rutas reales, y
// verifican que la respuesta sea 500 (no un cuelgue) sin filtrar detalles
// internos, y sin disparar unhandledRejection.
import { describe, it, expect, beforeEach, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { pool } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../middleware/auth';
import { resetDb, getAdminId } from '../../services/__tests__/helpers';

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

describe('manejo de errores async (no debe colgarse ni matar el proceso)', () => {
  let unhandledRejection = false;
  const onUnhandledRejection = () => {
    unhandledRejection = true;
  };

  beforeEach(() => {
    unhandledRejection = false;
    process.on('unhandledRejection', onUnhandledRejection);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandledRejection);
  });

  // analytics.ts: router sin ningún try/catch.
  it('GET /api/admin/analytics/overview devuelve 500 (no se cuelga) si la query falla', async () => {
    await pool.query('ALTER TABLE check_ins RENAME TO check_ins_tmp_analytics');
    try {
      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .query({ from: '2024-01-01', to: '2024-01-31' })
        .set(auth())
        .timeout({ response: 5000, deadline: 8000 });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Error interno del servidor' });
    } finally {
      await pool.query('ALTER TABLE check_ins_tmp_analytics RENAME TO check_ins');
    }

    // Esperamos un tick a que cualquier rechazo tardío se dispare, para que
    // el afterEach lo detecte si existiera.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(unhandledRejection).toBe(false);
  });

  // admin.ts: router que SÍ tiene try/catch (maneja 23505 de DNI duplicado),
  // pero termina en `throw err` para cualquier otro error, que debe llegar
  // igual al error handler global sin colgar la request.
  it('POST /api/admin/members devuelve 500 (no se cuelga) si la tabla no existe', async () => {
    await pool.query('ALTER TABLE members RENAME TO members_tmp_admin');
    try {
      const res = await request(app)
        .post('/api/admin/members')
        .send({ nombre: 'Juan', apellido: 'Perez', dni: '12345678', password: 'secreto123' })
        .set(auth())
        .timeout({ response: 5000, deadline: 8000 });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Error interno del servidor' });
    } finally {
      await pool.query('ALTER TABLE members_tmp_admin RENAME TO members');
    }

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(unhandledRejection).toBe(false);
  });
});
