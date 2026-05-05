import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
router.use(authMiddleware, requireRole('admin'));

router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM categorias ORDER BY orden, nombre');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { nombre, orden = 0 } = req.body;
  if (!nombre) { res.status(400).json({ error: 'nombre es requerido' }); return; }
  try {
    const { rows } = await pool.query(
      'INSERT INTO categorias (nombre, orden) VALUES ($1, $2) RETURNING *',
      [String(nombre).trim(), orden]
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Ya existe esa categoría' });
    } else {
      throw err;
    }
  }
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM categorias WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
