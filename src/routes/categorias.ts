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
  const { nombre, orden = 0, color } = req.body;
  if (!nombre) { res.status(400).json({ error: 'nombre es requerido' }); return; }
  try {
    const { rows } = await pool.query(
      'INSERT INTO categorias (nombre, orden, color) VALUES ($1, $2, $3) RETURNING *',
      [String(nombre).trim(), orden, color || '#E5484D']
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

router.put('/:id', async (req, res) => {
  const { nombre, color } = req.body;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (nombre !== undefined) { sets.push(`nombre = $${sets.length + 1}`); vals.push(String(nombre).trim()); }
  if (color !== undefined) { sets.push(`color = $${sets.length + 1}`); vals.push(color); }
  if (sets.length === 0) { res.status(400).json({ error: 'Nada que actualizar' }); return; }
  vals.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE categorias SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM categorias WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
