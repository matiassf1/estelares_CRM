// Entorno para los tests de integración, que corren contra un PostgreSQL real.
// Debe ejecutarse antes de que cualquier módulo importe src/db.ts, porque el
// Pool se construye en tiempo de import a partir de DATABASE_URL.
process.env.JWT_SECRET = 'test-jwt-secret-key-for-vitest';
process.env.ASSOC_QR_SECRET = 'test-qr-secret-for-vitest';
process.env.QR_SECRET = 'test-qr-secret-checkin-for-vitest';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  'postgresql://estelares:estelares@localhost:55432/estelares_test';
