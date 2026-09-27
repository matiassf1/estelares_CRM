import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// All vi.mock calls must be at top level (they get hoisted)
vi.mock('../../../db', () => ({
  pool: {
    query: vi.fn(),
  },
  initDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../utils/assocQr', () => ({
  verifyPlayerQr: vi.fn(),
  generatePlayerQr: vi.fn(),
  parsePlayerQrId: vi.fn(),
  generateQrSecret: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
    hashSync: vi.fn(),
    compareSync: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

import { pool } from '../../../db';
import { verifyPlayerQr } from '../../../utils/assocQr';
import bcrypt from 'bcryptjs';
import { createApp } from '../../../app';
import { signAssocToken } from '../../../middleware/assocAuth';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockVerifyQr = verifyPlayerQr as ReturnType<typeof vi.fn>;
const mockBcryptCompare = vi.mocked(bcrypt.compare);

// Valid JWT token used for authenticated requests
const TEST_ASSOC_ID = 'assoc-id-1';
const TEST_OP_ID = 'operator-id-1';
const validToken = signAssocToken({
  id: TEST_OP_ID,
  type: 'assoc_operator',
  associationId: TEST_ASSOC_ID,
  role: 'OPERATOR',
});

const app = createApp();

const MATCH_ID = 'match-uuid-0001';
const PLAYER_ID = '11111111-1111-1111-1111-111111111111';
// QR: valid UUID + dot + exactly 24-char hex
const VALID_QR = `${PLAYER_ID}.aabbccddeeff00112233aabb`;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Auth tests ────────────────────────────────────────────────────────────────

describe('POST /api/assoc/auth/login', () => {
  it('1. returns 200 with token on valid credentials', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: TEST_OP_ID,
        username: 'admin',
        password_hash: '$2b$10$somehash',
        role: 'ADMIN',
        association_id: TEST_ASSOC_ID,
        assoc_id: TEST_ASSOC_ID,
        active: true,
      }],
    });
    mockBcryptCompare.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/assoc/auth/login')
      .send({ username: 'admin', password: 'correctpassword' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe('ADMIN');
  });

  it('2. returns 401 on invalid credentials (user not found)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/assoc/auth/login')
      .send({ username: 'nobody', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciales inválidas');
  });
});

// ─── Matches list ─────────────────────────────────────────────────────────────

describe('GET /api/assoc/matches', () => {
  it('3. returns 401 with no auth token', async () => {
    const res = await request(app).get('/api/assoc/matches');
    expect(res.status).toBe(401);
  });

  it('4. returns 200 with match array on valid auth', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: MATCH_ID, status: 'SCHEDULED', home_team_name: 'Team A', away_team_name: 'Team B' },
      ],
    });

    const res = await request(app)
      .get('/api/assoc/matches')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe(MATCH_ID);
  });
});

// ─── Open accreditation ───────────────────────────────────────────────────────

describe('PATCH /api/assoc/matches/:id/open', () => {
  it('5. returns 200 with ACCREDITATION_OPEN status', async () => {
    const updatedMatch = { id: MATCH_ID, status: 'ACCREDITATION_OPEN' };
    mockQuery
      .mockResolvedValueOnce({ rows: [updatedMatch] })  // UPDATE match
      .mockResolvedValueOnce({ rows: [] });              // INSERT audit_log

    const res = await request(app)
      .patch(`/api/assoc/matches/${MATCH_ID}/open`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACCREDITATION_OPEN');
  });

  it('6. returns 404 when match not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch(`/api/assoc/matches/nonexistent/open`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no encontrado/i);
  });
});

// ─── Accredit endpoint ────────────────────────────────────────────────────────

describe('POST /api/assoc/matches/:id/accredit', () => {
  it('7. returns INVALID_QR when qr body is missing', async () => {
    const res = await request(app)
      .post(`/api/assoc/matches/${MATCH_ID}/accredit`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.result).toBe('INVALID_QR');
  });

  it('8. returns PLAYER_NOT_FOUND when player does not exist in DB', async () => {
    const match = {
      id: MATCH_ID, status: 'ACCREDITATION_OPEN',
      home_team_id: 'ht1', away_team_id: 'at1', season_id: 's1',
      association_id: TEST_ASSOC_ID,
    };
    mockQuery
      .mockResolvedValueOnce({ rows: [match] })
      .mockResolvedValueOnce({ rows: [] }); // player not found

    const res = await request(app)
      .post(`/api/assoc/matches/${MATCH_ID}/accredit`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ qr: VALID_QR });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('PLAYER_NOT_FOUND');
  });

  it('9. returns NOT_ELIGIBLE when registration status is PENDING', async () => {
    const match = {
      id: MATCH_ID, status: 'ACCREDITATION_OPEN',
      home_team_id: 'ht1', away_team_id: 'at1', season_id: 's1',
      association_id: TEST_ASSOC_ID,
    };
    const player = { id: PLAYER_ID, first_name: 'Juan', last_name: 'Perez', qr_secret: 'secret123', deleted_at: null };
    const registration = {
      id: 'reg1', player_id: PLAYER_ID, team_id: 'ht1',
      status: 'PENDING', season_id: 's1', team_name: 'Team A',
      valid_from: null, valid_until: null,
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [match] })
      .mockResolvedValueOnce({ rows: [player] })
      .mockResolvedValueOnce({ rows: [registration] });

    mockVerifyQr.mockReturnValue(PLAYER_ID);

    const res = await request(app)
      .post(`/api/assoc/matches/${MATCH_ID}/accredit`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ qr: VALID_QR });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('NOT_ELIGIBLE');
  });

  it('10. returns NOT_IN_MATCH when player has no registration in either team', async () => {
    const match = {
      id: MATCH_ID, status: 'ACCREDITATION_OPEN',
      home_team_id: 'ht1', away_team_id: 'at1', season_id: 's1',
      association_id: TEST_ASSOC_ID,
    };
    const player = { id: PLAYER_ID, first_name: 'Juan', last_name: 'Perez', qr_secret: 'secret123', deleted_at: null };

    mockQuery
      .mockResolvedValueOnce({ rows: [match] })
      .mockResolvedValueOnce({ rows: [player] })
      .mockResolvedValueOnce({ rows: [] }); // no registration

    mockVerifyQr.mockReturnValue(PLAYER_ID);

    const res = await request(app)
      .post(`/api/assoc/matches/${MATCH_ID}/accredit`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ qr: VALID_QR });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('NOT_IN_MATCH');
  });

  it('11. returns ACCREDITED on successful first accreditation', async () => {
    const match = {
      id: MATCH_ID, status: 'ACCREDITATION_OPEN',
      home_team_id: 'ht1', away_team_id: 'at1', season_id: 's1',
      association_id: TEST_ASSOC_ID,
    };
    const player = { id: PLAYER_ID, first_name: 'Juan', last_name: 'Perez', photo_url: null, qr_secret: 'secret123', deleted_at: null };
    const registration = {
      id: 'reg1', player_id: PLAYER_ID, team_id: 'ht1',
      status: 'ENABLED', season_id: 's1', team_name: 'Team A',
      valid_from: null, valid_until: null,
    };
    const accreditation = { id: 'acc1', match_id: MATCH_ID, player_id: PLAYER_ID, accredited_at: new Date().toISOString() };

    mockQuery
      .mockResolvedValueOnce({ rows: [match] })
      .mockResolvedValueOnce({ rows: [player] })
      .mockResolvedValueOnce({ rows: [registration] })
      .mockResolvedValueOnce({ rows: [accreditation] })   // INSERT returning
      .mockResolvedValueOnce({ rows: [] });                // audit_log

    mockVerifyQr.mockReturnValue(PLAYER_ID);

    const res = await request(app)
      .post(`/api/assoc/matches/${MATCH_ID}/accredit`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ qr: VALID_QR });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('ACCREDITED');
    expect(res.body.player.id).toBe(PLAYER_ID);
    expect(res.body.player.firstName).toBe('Juan');
  });

  it('12. returns ALREADY_ACCREDITED on duplicate scan (ON CONFLICT DO NOTHING)', async () => {
    const match = {
      id: MATCH_ID, status: 'ACCREDITATION_OPEN',
      home_team_id: 'ht1', away_team_id: 'at1', season_id: 's1',
      association_id: TEST_ASSOC_ID,
    };
    const player = { id: PLAYER_ID, first_name: 'Juan', last_name: 'Perez', photo_url: null, qr_secret: 'secret123', deleted_at: null };
    const registration = {
      id: 'reg1', player_id: PLAYER_ID, team_id: 'ht1',
      status: 'ENABLED', season_id: 's1', team_name: 'Team A',
      valid_from: null, valid_until: null,
    };
    const existingRow = { accredited_at: new Date().toISOString() };

    mockQuery
      .mockResolvedValueOnce({ rows: [match] })
      .mockResolvedValueOnce({ rows: [player] })
      .mockResolvedValueOnce({ rows: [registration] })
      .mockResolvedValueOnce({ rows: [] })             // INSERT returns empty (conflict)
      .mockResolvedValueOnce({ rows: [existingRow] }); // SELECT existing record

    mockVerifyQr.mockReturnValue(PLAYER_ID);

    const res = await request(app)
      .post(`/api/assoc/matches/${MATCH_ID}/accredit`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ qr: VALID_QR });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('ALREADY_ACCREDITED');
    expect(res.body.player.id).toBe(PLAYER_ID);
  });
});
