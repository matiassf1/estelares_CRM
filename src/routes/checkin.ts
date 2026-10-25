import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { isValidToken } from '../utils/token';
import { CHECKED_IN_DATE_AR, todayArgentina } from '../utils/time';
import { getMembershipState, assertCanCheckIn, MembershipError } from '../services/membership';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/', authMiddleware, requireRole('member'), asyncHandler(async (req, res) => {
  const { token } = req.body;
  const memberId = req.user!.id;

  if (!token || !isValidToken(String(token))) {
    res.status(400).json({ error: 'QR inválido o expirado' });
    return;
  }

  // INSERT atómico: el unique index en (member_id, DATE) garantiza
  // que dos requests simultáneas no produzcan check-ins duplicados.
  // Regla A: el permiso de ingreso se evalúa contra el estado de membresía
  // vigente en la base, no contra el token. Un JWT emitido antes de la
  // suspensión sigue autenticando (Regla B) pero no habilita el ingreso.
  try {
    assertCanCheckIn(await getMembershipState(memberId));
  } catch (err) {
    if (err instanceof MembershipError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    throw err;
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
}));

router.get('/today-status', authMiddleware, requireRole('member'), asyncHandler(async (req, res) => {
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
}));

router.get('/today', authMiddleware, requireRole('admin', 'portero'), asyncHandler(async (req, res) => {
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
}));

router.post('/by-member', authMiddleware, requireRole('admin', 'portero'), asyncHandler(async (req, res) => {
  const { member_id } = req.body;

  if (!member_id || typeof member_id !== 'string') {
    res.status(400).json({ error: 'member_id requerido' });
    return;
  }

  const { rows: memberRows } = await pool.query(
    'SELECT id, nombre, apellido FROM members WHERE id = $1',
    [member_id]
  );

  if (!memberRows[0]) {
    res.status(404).json({ error: 'Jugador no encontrado' });
    return;
  }

  // Regla A: misma barrera que el check-in por QR dinámico. Un carnet copiado
  // o reutilizado tampoco evade la suspensión, porque la decisión se toma acá.
  try {
    assertCanCheckIn(await getMembershipState(member_id));
  } catch (err) {
    if (err instanceof MembershipError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    throw err;
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
    "INSERT INTO check_ins (member_id, token_used) VALUES ($1, 'qr-scan') ON CONFLICT DO NOTHING",
    [member_id]
  );

  res.json({ ok: true, member: { nombre: memberRows[0].nombre, apellido: memberRows[0].apellido }, already: false });
}));

export default router;
