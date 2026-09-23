import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { pool } from '../db';
import { signToken, authMiddleware, requireRole } from '../middleware/auth';
import { sendPasswordReset } from '../utils/mailer';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, esperá 15 minutos' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { dni, password } = req.body;
  if (!dni || !password) {
    res.status(400).json({ error: 'DNI y contraseña requeridos' });
    return;
  }
  const { rows } = await pool.query('SELECT * FROM members WHERE dni = $1', [String(dni)]);
  const member = rows[0];
  // Validate credentials first so brute-forcers always get 401
  if (!member || !(await bcrypt.compare(String(password), member.password_hash))) {
    res.status(401).json({ error: 'DNI o contraseña incorrectos' });
    return;
  }
  if (!member.activo) {
    res.status(403).json({ error: 'Cuenta suspendida' });
    return;
  }
  const token = signToken({ id: member.id, type: 'member' });
  res.json({
    token,
    user: { id: member.id, nombre: member.nombre, apellido: member.apellido, dni: member.dni },
  });
});

router.post('/admin/login', loginLimiter, async (req, res) => {
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
       WHERE m.id = $1 AND m.activo = true`,
      [id]
    );
    if (!rows[0]) { res.status(401).json({ error: 'Cuenta desactivada' }); return; }
    res.json({ type, ...rows[0] });
  } else {
    const { rows } = await pool.query(
      'SELECT id, username, role FROM admins WHERE id = $1',
      [id]
    );
    res.json({ type, ...rows[0] });
  }
});

router.put('/change-password', authMiddleware, requireRole('member'), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
    return;
  }
  const { rows } = await pool.query('SELECT password_hash FROM members WHERE id = $1', [req.user!.id]);
  const member = rows[0];
  if (!member || !(await bcrypt.compare(String(currentPassword), member.password_hash))) {
    res.status(401).json({ error: 'Contraseña actual incorrecta' });
    return;
  }
  const hash = await bcrypt.hash(String(newPassword), 10);
  await pool.query('UPDATE members SET password_hash = $1 WHERE id = $2', [hash, req.user!.id]);
  res.json({ ok: true });
});

router.post('/forgot-password', loginLimiter, async (req, res) => {
  const { dni } = req.body;
  // Siempre { ok: true }: no revelamos si el DNI existe ni si tiene email cargado
  if (!dni) {
    res.json({ ok: true });
    return;
  }
  const { rows } = await pool.query('SELECT id, email FROM members WHERE dni = $1', [String(dni)]);
  const member = rows[0];
  if (!member || !member.email) {
    res.json({ ok: true });
    return;
  }
  const token = randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO password_reset_tokens (member_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
    [member.id, token]
  );
  try {
    await sendPasswordReset(member.email, `${APP_URL}/reset-password?token=${token}`);
  } catch (err) {
    console.error('Error enviando email de reset:', err);
  }
  res.json({ ok: true });
});

router.post('/reset-password', loginLimiter, async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    res.status(400).json({ error: 'Token inválido o expirado' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, member_id FROM password_reset_tokens
     WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [String(token)]
  );
  const reset = rows[0];
  if (!reset) {
    res.status(400).json({ error: 'Token inválido o expirado' });
    return;
  }
  const hash = await bcrypt.hash(String(newPassword), 10);
  await pool.query('UPDATE members SET password_hash = $1 WHERE id = $2', [hash, reset.member_id]);
  await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [reset.id]);
  res.json({ ok: true });
});

export default router;
