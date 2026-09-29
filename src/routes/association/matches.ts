import { Router } from 'express';
import { pool } from '../../db';
import { assocAuthMiddleware } from '../../middleware/assocAuth';
import { verifyPlayerQr } from '../../utils/assocQr';

const router = Router();
router.use(assocAuthMiddleware);

// List matches
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*,
         ht.name as home_team_name, hc.name as home_club_name,
         at2.name as away_team_name, ac2.name as away_club_name,
         s.name as season_name
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN clubs hc ON hc.id = ht.club_id
       JOIN teams at2 ON at2.id = m.away_team_id
       JOIN clubs ac2 ON ac2.id = at2.club_id
       JOIN seasons s ON s.id = m.season_id
       WHERE m.association_id = $1
       ORDER BY m.scheduled_at DESC`,
      [req.assocUser!.associationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[assoc/matches GET]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Open accreditation
router.patch('/:id/open', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE matches SET status = 'ACCREDITATION_OPEN', updated_at = NOW()
       WHERE id = $1 AND association_id = $2 AND status = 'SCHEDULED'
       RETURNING *`,
      [req.params.id, req.assocUser!.associationId]
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Partido no encontrado o ya no es SCHEDULED' });
      return;
    }
    await pool.query(
      `INSERT INTO audit_log (entity, entity_id, action, new_value, performed_by)
       VALUES ('match', $1, 'accreditation_opened', $2::jsonb, $3)`,
      [rows[0].id, JSON.stringify({ status: 'ACCREDITATION_OPEN' }), req.assocUser!.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[assoc/matches/open]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Core accreditation endpoint — race-condition safe via UNIQUE + ON CONFLICT
router.post('/:id/accredit', async (req, res) => {
  try {
    const matchId = req.params.id;
    const { qr } = req.body as { qr: string };
    if (!qr) {
      res.status(400).json({ result: 'INVALID_QR', error: 'QR requerido' });
      return;
    }

    // Fetch match, verify association
    const matchRes = await pool.query(
      `SELECT * FROM matches WHERE id = $1 AND association_id = $2`,
      [matchId, req.assocUser!.associationId]
    );
    const match = matchRes.rows[0];
    if (!match) {
      res.status(404).json({ result: 'INVALID_QR', error: 'Partido no encontrado' });
      return;
    }

    if (match.status !== 'ACCREDITATION_OPEN') {
      res.json({ result: 'ACCREDITATION_CLOSED' });
      return;
    }

    // Parse playerId from QR (UUID ends before last dot)
    const lastDot = qr.lastIndexOf('.');
    if (lastDot === -1) { res.json({ result: 'INVALID_QR' }); return; }
    const candidatePlayerId = qr.slice(0, lastDot);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidatePlayerId)) {
      res.json({ result: 'INVALID_QR' }); return;
    }

    // Fetch player to get their qr_secret for HMAC verification
    const playerRes = await pool.query(
      `SELECT * FROM players WHERE id = $1 AND deleted_at IS NULL`,
      [candidatePlayerId]
    );
    const player = playerRes.rows[0];
    if (!player) { res.json({ result: 'PLAYER_NOT_FOUND' }); return; }

    // Verify HMAC signature
    const verifiedId = verifyPlayerQr(qr, player.qr_secret);
    if (!verifiedId) { res.json({ result: 'INVALID_QR' }); return; }

    // Check if player has ANY registration this season (regardless of team) — buena fe case
    const { rows: anyReg } = await pool.query(
      `SELECT id FROM player_registrations
       WHERE player_id = $1 AND season_id = $2 AND deleted_at IS NULL`,
      [player.id, match.season_id]
    );
    if (anyReg.length === 0) {
      res.json({
        result: 'NOT_IN_REGISTRY',
        player: {
          firstName: player.first_name,
          lastName: player.last_name,
          photoUrl: player.photo_url ?? null,
        },
      });
      return;
    }

    // Find registration for this player in either team of the match
    const regRes = await pool.query(
      `SELECT pr.*, t.name as team_name
       FROM player_registrations pr
       JOIN teams t ON t.id = pr.team_id
       WHERE pr.player_id = $1
         AND pr.team_id IN ($2, $3)
         AND pr.season_id = $4
         AND pr.deleted_at IS NULL
       LIMIT 1`,
      [player.id, match.home_team_id, match.away_team_id, match.season_id]
    );
    const registration = regRes.rows[0];
    if (!registration) { res.json({ result: 'NOT_IN_MATCH' }); return; }

    if (registration.status !== 'ENABLED') {
      res.json({
        result: 'NOT_ELIGIBLE',
        status: registration.status,
        reason: registration.status_reason ?? null,
        player: {
          id: player.id,
          firstName: player.first_name,
          lastName: player.last_name,
          photoUrl: player.photo_url ?? null,
          teamName: registration.team_name,
        },
      });
      return;
    }

    const now = new Date();
    if (registration.valid_from && new Date(registration.valid_from) > now) {
      res.json({ result: 'NOT_ELIGIBLE', reason: 'Habilitación no vigente aún' }); return;
    }
    if (registration.valid_until && new Date(registration.valid_until) < now) {
      res.json({ result: 'NOT_ELIGIBLE', reason: 'Habilitación vencida' }); return;
    }

    // INSERT with ON CONFLICT — the UNIQUE(match_id, player_id) index is the authority
    const snapshot = {
      registration_status: registration.status,
      team_id: registration.team_id,
      season_id: registration.season_id,
    };

    const insertRes = await pool.query(
      `INSERT INTO match_accreditations
         (match_id, player_id, registration_id, team_id, accredited_by, validation_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (match_id, player_id) DO NOTHING
       RETURNING *`,
      [matchId, player.id, registration.id, registration.team_id,
       req.assocUser!.id, JSON.stringify(snapshot)]
    );

    if (insertRes.rows.length === 0) {
      // Duplicate — race condition absorbed by DB
      const existing = await pool.query(
        `SELECT accredited_at FROM match_accreditations WHERE match_id = $1 AND player_id = $2`,
        [matchId, player.id]
      );
      res.json({
        result: 'ALREADY_ACCREDITED',
        player: {
          id: player.id,
          firstName: player.first_name,
          lastName: player.last_name,
          photoUrl: player.photo_url ?? null,
          teamName: registration.team_name,
        },
        accreditedAt: existing.rows[0]?.accredited_at ?? null,
      });
      return;
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (entity, entity_id, action, new_value, performed_by)
       VALUES ('match_accreditation', $1, 'accredited', $2::jsonb, $3)`,
      [insertRes.rows[0].id, JSON.stringify(snapshot), req.assocUser!.id]
    );

    res.json({
      result: 'ACCREDITED',
      player: {
        id: player.id,
        firstName: player.first_name,
        lastName: player.last_name,
        photoUrl: player.photo_url ?? null,
        teamName: registration.team_name,
      },
      accreditedAt: insertRes.rows[0].accredited_at,
    });
  } catch (err) {
    console.error('[assoc/matches/accredit]', err);
    res.status(500).json({ result: 'INVALID_QR', error: 'Error interno' });
  }
});

// List accreditations
router.get('/:id/accreditations', async (req, res) => {
  try {
    // Verify match belongs to operator's association
    const matchCheck = await pool.query(
      `SELECT id FROM matches WHERE id = $1 AND association_id = $2`,
      [req.params.id, req.assocUser!.associationId]
    );
    if (!matchCheck.rows[0]) { res.status(403).json({ error: 'Sin acceso' }); return; }

    const { rows } = await pool.query(
      `SELECT ma.*,
         p.first_name, p.last_name, p.photo_url, p.document_type, p.document_number,
         t.name as team_name,
         c.name as club_name
       FROM match_accreditations ma
       JOIN players p ON p.id = ma.player_id
       JOIN teams t ON t.id = ma.team_id
       JOIN clubs c ON c.id = t.club_id
       WHERE ma.match_id = $1
       ORDER BY ma.accredited_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[assoc/matches/accreditations]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
