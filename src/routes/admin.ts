import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
router.use(authMiddleware, requireRole('admin'));

router.get('/members', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nombre, apellido, dni, patente, foto_url, activo, created_at FROM members ORDER BY apellido, nombre'
  );
  res.json(rows);
});

router.post('/members', async (req, res) => {
  const { nombre, apellido, dni, patente, password, foto_url } = req.body;
  if (!nombre || !apellido || !dni || !password) {
    res.status(400).json({ error: 'nombre, apellido, dni y password son requeridos' });
    return;
  }
  const hash = await bcrypt.hash(String(password), 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO members (nombre, apellido, dni, patente, password_hash, foto_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, apellido, dni, patente, foto_url, activo',
      [nombre, apellido, String(dni), patente || null, hash, foto_url || null]
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
  const { nombre, apellido, dni, patente, activo, password } = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  const { foto_url } = req.body;
  if (nombre !== undefined) { fields.push(`nombre=$${i++}`); values.push(nombre); }
  if (apellido !== undefined) { fields.push(`apellido=$${i++}`); values.push(apellido); }
  if (dni !== undefined) { fields.push(`dni=$${i++}`); values.push(String(dni)); }
  if (patente !== undefined) { fields.push(`patente=$${i++}`); values.push(patente || null); }
  if (activo !== undefined) { fields.push(`activo=$${i++}`); values.push(activo); }
  if (foto_url !== undefined) { fields.push(`foto_url=$${i++}`); values.push(foto_url || null); }
  if (password) { fields.push(`password_hash=$${i++}`); values.push(await bcrypt.hash(String(password), 10)); }

  if (!fields.length) {
    res.status(400).json({ error: 'Nada que actualizar' });
    return;
  }

  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE members SET ${fields.join(', ')} WHERE id=$${i} RETURNING id, nombre, apellido, dni, patente, foto_url, activo`,
    values
  );
  res.json(rows[0]);
});

router.delete('/members/:id', async (req, res) => {
  await pool.query('DELETE FROM members WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

router.get('/stats', async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const [{ rows: todayRows }, { rows: totalRows }] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) as count FROM check_ins WHERE DATE(checked_in_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = $1`,
      [today]
    ),
    pool.query('SELECT COUNT(*) as count FROM members WHERE activo = true'),
  ]);
  res.json({ today: parseInt(todayRows[0].count), total: parseInt(totalRows[0].count) });
});

export default router;
