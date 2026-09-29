import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../../db';
import { signAssocToken } from '../../middleware/assocAuth';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string };
    if (!username || !password) {
      res.status(400).json({ error: 'Credenciales requeridas' });
      return;
    }
    const { rows } = await pool.query(
      `SELECT ao.*, a.id as assoc_id
       FROM association_operators ao
       JOIN associations a ON a.id = ao.association_id
       WHERE ao.username = $1 AND ao.active = true`,
      [username]
    );
    const op = rows[0];
    if (!op || !(await bcrypt.compare(password, op.password_hash))) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    const token = signAssocToken({
      id: op.id,
      type: 'assoc_operator',
      associationId: op.association_id,
      role: op.role as 'ADMIN' | 'OPERATOR',
    });
    res.json({ token, role: op.role, associationId: op.association_id });
  } catch (err) {
    console.error('[assoc/auth/login]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
