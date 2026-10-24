import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { CHECKED_IN_DATE_AR, todayArgentina } from '../utils/time';

const router = Router();
router.use(authMiddleware, requireRole('admin'));

router.get('/members', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : null;
  if (status && !['ACTIVE', 'SUSPENDED', 'TERMINATED'].includes(status)) {
    res.status(400).json({ error: 'status inválido' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT m.id, m.nombre, m.apellido, m.dni, m.patente, m.foto_url, m.activo,
            m.tipo_vehiculo, m.categoria_id, c.nombre AS categoria_nombre,
            s.status, s.status_since, s.status_until, s.status_reason, s.needs_review
     FROM members m
     LEFT JOIN categorias c ON m.categoria_id = c.id
     JOIN member_membership_state s ON s.member_id = m.id
     ${status ? 'WHERE s.status = $1' : ''}
     ORDER BY m.apellido, m.nombre`,
    status ? [status] : []
  );
  res.json(rows);
});

router.post('/members', async (req, res) => {
  const { nombre, apellido, dni, patente, password, foto_url, categoria_id, tipo_vehiculo } = req.body;
  if (!nombre || !apellido || !dni || !password) {
    res.status(400).json({ error: 'nombre, apellido, dni y password son requeridos' });
    return;
  }
  const hash = await bcrypt.hash(String(password), 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO members (nombre, apellido, dni, patente, password_hash, foto_url, categoria_id, tipo_vehiculo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, nombre, apellido, dni, patente, foto_url, activo, tipo_vehiculo, categoria_id`,
      [nombre, apellido, String(dni), patente || null, hash, foto_url || null, categoria_id || null, tipo_vehiculo || null]
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'Ya existe un jugador con ese DNI' });
    } else {
      throw err;
    }
  }
});

router.put('/members/:id', async (req, res) => {
  const { nombre, apellido, dni, patente, password } = req.body;

  // El estado de membresía NO se cambia por este endpoint genérico: saltearía
  // la validación de transiciones, las fechas efectivas, la liberación de
  // cochera y la auditoría. Ver routes/admin-membership.ts.
  if (req.body.activo !== undefined || req.body.status !== undefined) {
    res.status(400).json({
      error: 'El estado de membresía se cambia desde /members/:id/suspend, /terminate o /reactivate',
    });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  const { foto_url, categoria_id, tipo_vehiculo } = req.body;
  if (nombre !== undefined) { fields.push(`nombre=$${i++}`); values.push(nombre); }
  if (apellido !== undefined) { fields.push(`apellido=$${i++}`); values.push(apellido); }
  if (dni !== undefined) { fields.push(`dni=$${i++}`); values.push(String(dni)); }
  if (patente !== undefined) { fields.push(`patente=$${i++}`); values.push(patente || null); }
  if (foto_url !== undefined) { fields.push(`foto_url=$${i++}`); values.push(foto_url || null); }
  if (categoria_id !== undefined) { fields.push(`categoria_id=$${i++}`); values.push(categoria_id || null); }
  if (tipo_vehiculo !== undefined) { fields.push(`tipo_vehiculo=$${i++}`); values.push(tipo_vehiculo || null); }
  if (password) { fields.push(`password_hash=$${i++}`); values.push(await bcrypt.hash(String(password), 10)); }

  if (!fields.length) {
    res.status(400).json({ error: 'Nada que actualizar' });
    return;
  }

  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE members SET ${fields.join(', ')} WHERE id=$${i} RETURNING id, nombre, apellido, dni, patente, foto_url, activo, tipo_vehiculo, categoria_id`,
    values
  );
  res.json(rows[0]);
});

// Regla E: el borrado físico deja de ser una operación administrativa.
// check_ins tiene ON DELETE CASCADE, por lo que un DELETE destruía el historial
// de asistencias completo del jugador sin posibilidad de recuperarlo.
router.delete('/members/:id', (_req, res) => {
  res.status(405).json({
    error:
      'La eliminación de jugadores fue reemplazada por la baja administrativa, que conserva el historial. Usá POST /members/:id/terminate',
  });
});

router.get('/stats', async (_req, res) => {
  const today = todayArgentina();
  const [{ rows: todayRows }, { rows: statusRows }] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) as count FROM check_ins WHERE ${CHECKED_IN_DATE_AR} = $1`,
      [today]
    ),
    // Regla C: tres categorías de padrón, no un binario.
    pool.query(
      `SELECT status, COUNT(*) AS count FROM member_membership_state GROUP BY status`
    ),
  ]);
  const byStatus: Record<string, number> = { ACTIVE: 0, SUSPENDED: 0, TERMINATED: 0 };
  for (const row of statusRows) byStatus[row.status] = parseInt(row.count);

  res.json({
    today: parseInt(todayRows[0].count),
    activos: byStatus.ACTIVE,
    suspendidos: byStatus.SUSPENDED,
    bajas: byStatus.TERMINATED,
    // `total` se mantiene por compatibilidad con el frontend actual. Deprecado.
    total: byStatus.ACTIVE,
  });
});

export default router;
