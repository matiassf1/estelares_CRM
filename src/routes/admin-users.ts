import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
// Administrar usuarios del panel es cosa del admin. El portero registra
// ingresos: darle de alta usuarios sería darle la llave del panel entero.
router.use(authMiddleware, requireRole('admin'));

/** Columnas devueltas al cliente. `password_hash` no figura acá a propósito. */
const PUBLIC_COLUMNS = 'id, username, role, created_at';

const ROLES = ['admin', 'portero'] as const;
const MIN_PASSWORD_LENGTH = 8;

/** `null` si la contraseña sirve; si no, el mensaje de error a devolver. */
function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  return null;
}

router.get('/users', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM admins ORDER BY role, username`
  );
  res.json(rows);
}));

router.post('/users', asyncHandler(async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ error: 'El nombre de usuario es obligatorio' });
    return;
  }
  if (!ROLES.includes(role)) {
    res.status(400).json({ error: "El rol debe ser 'admin' o 'portero'" });
    return;
  }
  const problem = passwordProblem(password);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }

  const hash = await bcrypt.hash(String(password), 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO admins (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING ${PUBLIC_COLUMNS}`,
      [username.trim(), hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'Ya existe un usuario con ese nombre' });
    } else {
      throw err;
    }
  }
}));

router.put('/users/:id/password', asyncHandler(async (req, res) => {
  const problem = passwordProblem(req.body.password);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }

  const hash = await bcrypt.hash(String(req.body.password), 10);
  const { rows } = await pool.query(
    `UPDATE admins SET password_hash = $1 WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [hash, req.params.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }
  res.json(rows[0]);
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, role FROM admins WHERE id = $1', [req.params.id]);
  const target = rows[0];
  if (!target) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }

  // El orden importa: si el último admin se borra a sí mismo, lo que hay que
  // decirle es que el club se queda sin acceso, no que no puede autoborrarse.
  if (target.role === 'admin') {
    const { rows: admins } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM admins WHERE role = 'admin'`
    );
    if (admins[0].count <= 1) {
      res.status(409).json({
        error: 'No se puede eliminar al último usuario admin: el club se quedaría sin acceso al panel',
      });
      return;
    }
  }

  if (target.id === req.user!.id) {
    res.status(409).json({ error: 'No podés eliminar tu propio usuario' });
    return;
  }

  await pool.query('DELETE FROM admins WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

export default router;
