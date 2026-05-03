require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const members = [
  { nombre: 'Lucas',    apellido: 'Fernández',  dni: '28451230', patente: 'AB123CD', password: '28451230' },
  { nombre: 'Matías',   apellido: 'González',   dni: '31892045', patente: 'GH456IJ', password: '31892045' },
  { nombre: 'Sebastián',apellido: 'Romero',     dni: '25674312', patente: 'KL789MN', password: '25674312' },
  { nombre: 'Diego',    apellido: 'Torres',     dni: '33210987', patente: null,       password: '33210987' },
  { nombre: 'Nicolás',  apellido: 'Martínez',   dni: '29876543', patente: 'OP012QR', password: '29876543' },
  { nombre: 'Andrés',   apellido: 'López',      dni: '26543210', patente: null,       password: '26543210' },
  { nombre: 'Federico', apellido: 'Sánchez',    dni: '34567890', patente: 'ST345UV', password: '34567890' },
  { nombre: 'Ezequiel', apellido: 'Ramírez',    dni: '27654321', patente: 'WX678YZ', password: '27654321' },
  { nombre: 'Ignacio',  apellido: 'Díaz',       dni: '30123456', patente: null,       password: '30123456' },
  { nombre: 'Rodrigo',  apellido: 'Pérez',      dni: '32456789', patente: 'BC901DE', password: '32456789' },
];

const extraStaff = [
  { username: 'portero2', password: 'portero456', role: 'portero' },
];

async function seed() {
  console.log('Poblando base de datos...\n');

  // Members
  let created = 0;
  let skipped = 0;
  for (const m of members) {
    const hash = await bcrypt.hash(m.password, 10);
    try {
      await pool.query(
        `INSERT INTO members (nombre, apellido, dni, patente, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (dni) DO NOTHING`,
        [m.nombre, m.apellido, m.dni, m.patente, hash]
      );
      created++;
      console.log(`  [OK] ${m.nombre} ${m.apellido} — DNI: ${m.dni}`);
    } catch (err) {
      skipped++;
      console.log(`  [--] ${m.nombre} ${m.apellido} ya existe, omitido`);
    }
  }

  console.log(`\nJugadores: ${created} creados, ${skipped} omitidos`);

  // Extra staff
  console.log('\nStaff adicional:');
  for (const s of extraStaff) {
    const hash = await bcrypt.hash(s.password, 10);
    try {
      await pool.query(
        `INSERT INTO admins (username, password_hash, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (username) DO NOTHING`,
        [s.username, hash, s.role]
      );
      console.log(`  [OK] ${s.username} (${s.role})`);
    } catch {
      console.log(`  [--] ${s.username} ya existe, omitido`);
    }
  }

  console.log('\nCredenciales de acceso:');
  console.log('  Staff  →  admin / admin123   |   portero / portero123   |   portero2 / portero456');
  console.log('  Jugadores → DNI como usuario y contraseña (ej: 28451230 / 28451230)');

  await pool.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
