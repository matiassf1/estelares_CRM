import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
router.use(authMiddleware, requireRole('admin'));

// GET /api/admin/training-schedules?categoriaId=N
router.get('/', async (req, res) => {
  const { categoriaId } = req.query;
  const rows = (await pool.query(
    `SELECT ts.*, c.nombre AS categoria_nombre
     FROM training_schedules ts
     JOIN categorias c ON c.id = ts.categoria_id
     ${categoriaId ? 'WHERE ts.categoria_id = $1' : ''}
     ORDER BY c.orden, ts.day_of_week, ts.start_time, ts.valid_from`,
    categoriaId ? [categoriaId] : []
  )).rows;
  res.json(rows);
});

// POST /api/admin/training-schedules
router.post('/', async (req, res) => {
  const { categoria_id, day_of_week, start_time, tolerance_min = 15, valid_from } = req.body;
  if (categoria_id == null || day_of_week == null || !start_time) {
    res.status(400).json({ error: 'categoria_id, day_of_week y start_time son requeridos' });
    return;
  }
  const { rows } = await pool.query(
    `INSERT INTO training_schedules (categoria_id, day_of_week, start_time, tolerance_min, valid_from)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [categoria_id, day_of_week, start_time, tolerance_min, valid_from || new Date().toISOString().slice(0, 10)]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/admin/training-schedules/:id — closes vigent schedule (preserves history)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { start_time, tolerance_min, valid_until } = req.body;
  if (!valid_until) {
    res.status(400).json({ error: 'valid_until requerido para cerrar un horario' });
    return;
  }
  const { rows } = await pool.query(
    `UPDATE training_schedules SET valid_until = $1,
       start_time = COALESCE($2, start_time),
       tolerance_min = COALESCE($3, tolerance_min)
     WHERE id = $4 RETURNING *`,
    [valid_until, start_time || null, tolerance_min || null, id]
  );
  if (!rows[0]) { res.status(404).json({ error: 'No encontrado' }); return; }
  res.json(rows[0]);
});

// DELETE /api/admin/training-schedules/:id — only allowed if valid_from >= today (no history)
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM training_schedules WHERE id = $1 AND valid_from >= CURRENT_DATE RETURNING id`,
    [req.params.id]
  );
  if (!rows[0]) {
    res.status(409).json({ error: 'No se puede eliminar un horario con historial. Cerralo con valid_until.' });
    return;
  }
  res.json({ ok: true });
});

export default router;
