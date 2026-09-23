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
    CREATE TABLE IF NOT EXISTS categorias (
      id     SERIAL PRIMARY KEY,
      nombre VARCHAR(50) UNIQUE NOT NULL,
      orden  INT DEFAULT 0
    );
  `);

  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS categoria_id INT REFERENCES categorias(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS tipo_vehiculo VARCHAR(15);`);
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS parking_spots (
      id           SERIAL PRIMARY KEY,
      spot_number  VARCHAR(20) UNIQUE NOT NULL,
      member_id    UUID REFERENCES members(id) ON DELETE SET NULL
    );
  `);

  // Prevents duplicate check-ins on the same local day (race-condition safe).
  // Uses a fixed -03:00 offset (Argentina, no DST) because AT TIME ZONE is
  // STABLE and PostgreSQL requires IMMUTABLE expressions in index definitions.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_member_checkin_day
      ON check_ins (member_id, CAST((checked_in_at - INTERVAL '3 hours') AS DATE));
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

  // Analytics: training schedules (temporal model)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_schedules (
      id            SERIAL PRIMARY KEY,
      categoria_id  INT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
      day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      start_time    TIME NOT NULL,
      tolerance_min SMALLINT NOT NULL DEFAULT 15,
      valid_from    DATE NOT NULL DEFAULT CURRENT_DATE,
      valid_until   DATE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT training_no_past_until CHECK (valid_until IS NULL OR valid_until > valid_from)
    );
  `);

  // Performance indexes for analytics queries
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_checkins_member   ON check_ins (member_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_checkins_date_ar  ON check_ins (CAST((checked_in_at - INTERVAL '3 hours') AS DATE));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_checkins_hour     ON check_ins (CAST(EXTRACT(HOUR FROM (checked_in_at - INTERVAL '3 hours')) AS INT));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_members_categoria ON members (categoria_id) WHERE activo = true;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_schedules_cat     ON training_schedules (categoria_id, day_of_week);`);
}
