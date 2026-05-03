import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
router.use(authMiddleware, requireRole('admin'));

// List all spots with assigned member
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT ps.id, ps.spot_number, ps.member_id,
           m.nombre, m.apellido, m.patente
    FROM   parking_spots ps
    LEFT JOIN members m ON ps.member_id = m.id
    ORDER  BY ps.spot_number
  `);
  res.json(rows);
});

// Create spot
router.post('/', async (req, res) => {
  const raw = String(req.body.spot_number ?? '').trim().toUpperCase();
  if (!raw) { res.status(400).json({ error: 'Número de espacio requerido' }); return; }
  try {
    const { rows } = await pool.query(
      'INSERT INTO parking_spots (spot_number) VALUES ($1) RETURNING *',
      [raw]
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Ya existe ese espacio' });
    } else { throw err; }
  }
});

// Assign a member to a spot (clears any previous assignment for that member)
router.put('/:id/assign', async (req, res) => {
  const { member_id } = req.body;
  if (!member_id) { res.status(400).json({ error: 'member_id requerido' }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE parking_spots SET member_id = NULL WHERE member_id = $1', [member_id]);
    const { rows } = await client.query(
      'UPDATE parking_spots SET member_id = $1 WHERE id = $2 RETURNING *',
      [member_id, req.params.id]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Unassign (free the spot)
router.put('/:id/unassign', async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE parking_spots SET member_id = NULL WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  res.json(rows[0]);
});

// Delete spot
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM parking_spots WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
