import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { isValidToken } from '../utils/token';
import { CHECKED_IN_DATE_AR, todayArgentina } from '../utils/time';

const router = Router();

router.post('/', authMiddleware, requireRole('member'), async (req, res) => {
  const { token } = req.body;
  const memberId = req.user!.id;

  if (!token || !isValidToken(String(token))) {
    res.status(400).json({ error: 'QR inválido o expirado' });
    return;
  }

  // INSERT atómico: el unique index en (member_id, DATE) garantiza
  // que dos requests simultáneas no produzcan check-ins duplicados.
  const { rows: memberRows } = await pool.query('SELECT activo FROM members WHERE id = $1', [memberId]);
  if (!memberRows[0]?.activo) {
    res.status(403).json({ error: 'Cuenta desactivada' });
    return;
  }

  let inserted: { rowCount: number | null };
  try {
    inserted = await pool.query(
      'INSERT INTO check_ins (member_id, token_used) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [memberId, String(token)]
    );
  } catch {
    res.status(500).json({ error: 'Error al registrar el ingreso' });
    return;
  }

  if (!inserted.rowCount) {
    res.status(409).json({ error: 'Ya registraste tu ingreso hoy' });
    return;
  }

  const { rows } = await pool.query(
    'SELECT nombre, apellido, patente FROM members WHERE id = $1',
    [memberId]
  );

  res.json({ ok: true, member: rows[0] });
});

router.get('/today-status', authMiddleware, requireRole('member'), async (req, res) => {
  const today = todayArgentina();
  const { rows } = await pool.query(
    `SELECT checked_in_at FROM check_ins WHERE member_id = $1 AND ${CHECKED_IN_DATE_AR} = $2`,
    [req.user!.id, today]
  );
  if (rows.length > 0) {
    res.json({ ingresado: true, hora: rows[0].checked_in_at });
  } else {
    res.json({ ingresado: false });
  }
});

router.get('/today', authMiddleware, requireRole('admin', 'portero'), async (req, res) => {
  const today = todayArgentina();
  const { rows } = await pool.query(
    `SELECT m.nombre, m.apellido, m.patente, m.tipo_vehiculo, c.checked_in_at
     FROM check_ins c
     JOIN members m ON c.member_id = m.id
     WHERE CAST((c.checked_in_at - INTERVAL '3 hours') AS DATE) = $1
     ORDER BY c.checked_in_at DESC`,
    [today]
  );
  res.json(rows);
});

router.post('/by-member', authMiddleware, requireRole('admin', 'portero'), async (req, res) => {
  const { member_id } = req.body;

  if (!member_id || typeof member_id !== 'string') {
    res.status(400).json({ error: 'member_id requerido' });
    return;
  }

  const { rows: memberRows } = await pool.query(
    'SELECT id, nombre, apellido, activo FROM members WHERE id = $1',
    [member_id]
  );

  if (!memberRows[0]) {
    res.status(404).json({ error: 'Jugador no encontrado' });
    return;
  }

  if (!memberRows[0].activo) {
    res.status(403).json({ error: 'Jugador inactivo' });
    return;
  }

  const today = todayArgentina();
  const { rows: existingRows } = await pool.query(
    `SELECT id FROM check_ins WHERE member_id = $1 AND DATE(checked_in_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = $2`,
    [member_id, today]
  );

  if (existingRows.length > 0) {
    res.json({ ok: true, member: { nombre: memberRows[0].nombre, apellido: memberRows[0].apellido }, already: true });
    return;
  }

  await pool.query(
    'INSERT INTO check_ins (member_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [member_id]
  );

  res.json({ ok: true, member: { nombre: memberRows[0].nombre, apellido: memberRows[0].apellido }, already: false });
});

export default router;
