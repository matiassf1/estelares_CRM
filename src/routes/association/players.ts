import { Router } from 'express';
import QRCode from 'qrcode';
import { pool } from '../../db';
import { assocAuthMiddleware } from '../../middleware/assocAuth';
import { generatePlayerQr } from '../../utils/assocQr';

const router = Router();
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
