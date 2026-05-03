import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { signToken, authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { dni, password } = req.body;
  if (!dni || !password) {
    res.status(400).json({ error: 'DNI y contraseña requeridos' });
    return;
  }
  const { rows } = await pool.query(
    'SELECT * FROM members WHERE dni = $1 AND activo = true',
    [String(dni)]
  );
  const member = rows[0];
  if (!member || !(await bcrypt.compare(String(password), member.password_hash))) {
    res.status(401).json({ error: 'DNI o contraseña incorrectos' });
    return;
  }
  const token = signToken({ id: member.id, type: 'member' });
  res.json({
    token,
    user: { id: member.id, nombre: member.nombre, apellido: member.apellido, dni: member.dni },
  });
});

router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    return;
  }
  const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(String(password), admin.password_hash))) {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    return;
  }
  const token = signToken({ id: admin.id, type: admin.role as 'admin' | 'portero' });
  res.json({
    token,
    user: { id: admin.id, username: admin.username, role: admin.role },
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  const { id, type } = req.user!;
  if (type === 'member') {
    const { rows } = await pool.query(
      `SELECT m.id, m.nombre, m.apellido, m.dni, m.patente, m.foto_url,
              ps.spot_number AS estacionamiento
       FROM members m
       LEFT JOIN parking_spots ps ON ps.member_id = m.id
       WHERE m.id = $1`,
      [id]
    );
    res.json({ type, ...rows[0] });
  } else {
    const { rows } = await pool.query(
      'SELECT id, username, role FROM admins WHERE id = $1',
      [id]
    );
    res.json({ type, ...rows[0] });
  }
});

export default router;
