import { Router } from 'express';
import QRCode from 'qrcode';
import { pool } from '../../db';
import { assocAuthMiddleware } from '../../middleware/assocAuth';
import { generatePlayerQr } from '../../utils/assocQr';

const router = Router();

// Demo endpoint — no auth required, must be before /:id routes
router.get('/demo/carnets', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.first_name, p.last_name, p.qr_secret,
             t.name as team_name, c.name as club_name,
             pr.status
      FROM players p
      JOIN player_registrations pr ON pr.player_id = p.id AND pr.deleted_at IS NULL
      JOIN teams t ON t.id = pr.team_id
      JOIN clubs c ON c.id = t.club_id
      ORDER BY t.name, p.last_name
    `);
    const result = rows.map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      teamName: r.team_name,
      clubName: r.club_name,
      status: r.status,
      qrPayload: generatePlayerQr(r.id, r.qr_secret),
    }));
    res.json(result);
  } catch (err) {
    console.error('[assoc/players/demo/carnets]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.use(assocAuthMiddleware);

router.get('/:id/carnet-qr', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, qr_secret, first_name, last_name
       FROM players WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    const player = rows[0];
    if (!player) { res.status(404).json({ error: 'Jugador no encontrado' }); return; }

    const payload = generatePlayerQr(player.id, player.qr_secret);
    const qrDataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', width: 300 });
    res.json({ qr: qrDataUrl, payload });
  } catch (err) {
    console.error('[assoc/players/carnet-qr]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
