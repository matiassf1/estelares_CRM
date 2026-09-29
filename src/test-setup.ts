// Set required env vars before any module is loaded
process.env.JWT_SECRET = 'test-jwt-secret-key-for-vitest';
process.env.ASSOC_QR_SECRET = 'test-qr-secret-for-vitest';
process.env.QR_SECRET = 'test-qr-secret-checkin-for-vitest';
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test_db';
