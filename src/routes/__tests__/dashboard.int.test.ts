import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../middleware/auth';
import { suspend } from '../../services/membership';
import { resetDb, getAdminId, createMember, addCheckIn } from '../../services/__tests__/helpers';

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
const get = () => request(app).get('/api/admin/dashboard').set(auth());

describe('GET /api/admin/dashboard', () => {
  it('exige rol admin', async () => {
    await request(app).get('/api/admin/dashboard').expect(401);
    const { rows } = await pool.query(`SELECT id FROM admins WHERE role='portero' LIMIT 1`);
    await request(app)
      .get('/api/admin/dashboard')
      .set({ Authorization: `Bearer ${signToken({ id: rows[0].id, type: 'portero' })}` })
      .expect(403);
  });

  it('cuenta a los que se descolgaron: activos con historial y sin venir hace +21 días', async () => {
    const viejo = await createMember();
    await addCheckIn(viejo, 40);
    const reciente = await createMember();
    await addCheckIn(reciente, 3);
    await createMember(); // sin historial: no se descolgó, nunca vino

    const res = await get().expect(200);
    expect(res.body.pendientes.descolgados).toBe(1);
  });

  it('un suspendido no cuenta como descolgado', async () => {
    const id = await createMember();
    await addCheckIn(id, 40);
    await suspend({ memberId: id, reason: 'Lesión', actorId: adminId });

    const res = await get().expect(200);
    expect(res.body.pendientes.descolgados).toBe(0);
  });

  it('cuenta los pendientes de revisión, sin foto y los horarios cargados', async () => {
    const id = await createMember();
    await pool.query(
      `INSERT INTO membership_periods
         (member_id, kind, effective_from, reason, created_by, legacy_migrated)
       VALUES ($1,'SUSPENSION',CAST((NOW() - INTERVAL '3 hours') AS DATE),'migrado',$2,true)`,
      [id, adminId]
    );
    const conFoto = await createMember();
    await pool.query(`UPDATE members SET foto_url='x' WHERE id=$1`, [conFoto]);
    await createMember(); // activo sin foto

    const res = await get().expect(200);
    expect(res.body.pendientes.a_revisar).toBe(1);
    expect(res.body.pendientes.sin_foto).toBe(1);
    expect(res.body.pendientes.horarios).toBe(0);
  });

  it('devuelve el pulso del club', async () => {
    const a = await createMember();
    await createMember();
    await addCheckIn(a, 2);
    await suspend({ memberId: a, reason: 'x', actorId: adminId });

    const res = await get().expect(200);
    expect(res.body.club.activos).toBe(1);
    expect(res.body.club.suspendidos).toBe(1);
    expect(res.body.club.ingresos_7d).toBe(1);
    expect(res.body.club.jugadores_7d).toBe(1);
  });

  it('clasifica las categorías por necesidad de atención', async () => {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nombre) VALUES ('AlDia'),('Tibia'),('Parada') RETURNING id, nombre`
    );
    const byName = Object.fromEntries(rows.map(r => [r.nombre, r.id]));

    const alDia = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [byName.AlDia, alDia]);
    await addCheckIn(alDia, 1);

    const tibia = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [byName.Tibia, tibia]);
    await addCheckIn(tibia, 10);

    const parada = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [byName.Parada, parada]);
    await addCheckIn(parada, 40);

    const res = await get().expect(200);
    const estado = Object.fromEntries(
      res.body.categorias.map((c: { nombre: string; estado: string }) => [c.nombre, c.estado])
    );
    expect(estado.AlDia).toBe('ok');
    expect(estado.Tibia).toBe('warn');
    expect(estado.Parada).toBe('alert');
  });

  it('ordena las categorías poniendo primero las que necesitan atención', async () => {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nombre) VALUES ('Uno'),('Dos') RETURNING id, nombre`
    );
    const byName = Object.fromEntries(rows.map(r => [r.nombre, r.id]));
    const ok = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [byName.Uno, ok]);
    await addCheckIn(ok, 1);
    const mal = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [byName.Dos, mal]);
    await addCheckIn(mal, 40);

    const res = await get().expect(200);
    expect(res.body.categorias[0].nombre).toBe('Dos');
  });

  it('una categoría sin jugadores activos no aparece', async () => {
    await pool.query(`INSERT INTO categorias (nombre) VALUES ('Vacia')`);
    const res = await get().expect(200);
    expect(res.body.categorias.map((c: { nombre: string }) => c.nombre)).not.toContain('Vacia');
  });

  it('una base vacía devuelve ceros sin romperse', async () => {
    const res = await get().expect(200);
    expect(res.body.pendientes).toEqual({ descolgados: 0, a_revisar: 0, sin_foto: 0, horarios: 0 });
    expect(res.body.club.activos).toBe(0);
    expect(res.body.categorias).toEqual([]);
  });
});
