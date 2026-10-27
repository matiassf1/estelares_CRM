import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../middleware/auth';
import { suspend, terminate } from '../../services/membership';
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

  it('cuenta las solicitudes de membresía pendientes, no las ya resueltas', async () => {
    const a = await createMember();
    const b = await createMember();
    await pool.query(
      `INSERT INTO membership_requests (member_id, kind, effective_from, reason, status)
       VALUES ($1,'TERMINATION',CAST((NOW() - INTERVAL '3 hours') AS DATE),'me voy','PENDING'),
              ($2,'SUSPENSION', CAST((NOW() - INTERVAL '3 hours') AS DATE),'viaje','REJECTED')`,
      [a, b]
    );

    const res = await get().expect(200);
    expect(res.body.pendientes.solicitudes).toBe(1);
  });

  it('una base vacía devuelve ceros sin romperse', async () => {
    const res = await get().expect(200);
    expect(res.body.pendientes).toEqual({
      descolgados: 0,
      a_revisar: 0,
      sin_foto: 0,
      horarios: 0,
      solicitudes: 0,
    });
    expect(res.body.club.activos).toBe(0);
    expect(res.body.categorias).toEqual([]);
  });

  it('una categoría cuyos jugadores activos nunca hicieron check-in queda en alert', async () => {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nombre) VALUES ('SinIngresos') RETURNING id, nombre`
    );
    const id = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [rows[0].id, id]);

    const res = await get().expect(200);
    const cat = res.body.categorias.find((c: { nombre: string }) => c.nombre === 'SinIngresos');
    expect(cat.estado).toBe('alert');
    expect(cat.ultimo_ingreso).toBeNull();
  });

  it('ultimo_ingreso tiene formato YYYY-MM-DD', async () => {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nombre) VALUES ('ConIngreso') RETURNING id, nombre`
    );
    const id = await createMember();
    await pool.query('UPDATE members SET categoria_id=$1 WHERE id=$2', [rows[0].id, id]);
    await addCheckIn(id, 1);

    const res = await get().expect(200);
    const cat = res.body.categorias.find((c: { nombre: string }) => c.nombre === 'ConIngreso');
    expect(cat.ultimo_ingreso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('un jugador dado de baja no cuenta como activo, ni en sin_foto, ni en descolgados', async () => {
    const id = await createMember();
    await addCheckIn(id, 40);
    await terminate({ memberId: id, reason: 'Retiro', actorId: adminId });

    const res = await get().expect(200);
    expect(res.body.club.activos).toBe(0);
    expect(res.body.club.bajas).toBe(1);
    expect(res.body.pendientes.sin_foto).toBe(0);
    expect(res.body.pendientes.descolgados).toBe(0);
  });
});
