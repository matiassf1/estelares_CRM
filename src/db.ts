import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre VARCHAR(100) NOT NULL,
      apellido VARCHAR(100) NOT NULL,
      dni VARCHAR(20) UNIQUE NOT NULL,
      patente VARCHAR(20),
      activo BOOLEAN DEFAULT true,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS check_ins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID REFERENCES members(id) ON DELETE CASCADE,
      checked_in_at TIMESTAMP DEFAULT NOW(),
      token_used VARCHAR(20) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'portero',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Safe migrations for existing deployments
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS foto_url TEXT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS parking_spots (
      id           SERIAL PRIMARY KEY,
      spot_number  VARCHAR(20) UNIQUE NOT NULL,
      member_id    UUID REFERENCES members(id) ON DELETE SET NULL
    );
  `);

  // Prevents duplicate check-ins on the same day (race-condition safe)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_member_checkin_day
      ON check_ins (member_id, DATE(checked_in_at AT TIME ZONE 'America/Argentina/Buenos_Aires'));
  `);

  const { rows } = await pool.query('SELECT COUNT(*) as count FROM admins');
  if (parseInt(rows[0].count) === 0) {
    const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    const porteroHash = await bcrypt.hash(process.env.PORTERO_PASSWORD || 'portero123', 10);
    await pool.query(
      `INSERT INTO admins (username, password_hash, role) VALUES ('admin', $1, 'admin'), ('portero', $2, 'portero')`,
      [adminHash, porteroHash]
    );
    console.log('Usuarios por defecto creados: admin / portero');
    console.log('Cambiar contraseñas desde el panel admin.');
  }
}
