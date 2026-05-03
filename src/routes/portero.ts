import { Router } from 'express';
import QRCode from 'qrcode';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getCurrentToken, secondsUntilNext } from '../utils/token';

const router = Router();

router.get('/qr', authMiddleware, requireRole('admin', 'portero'), async (_req, res) => {
  const token = getCurrentToken();
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const url = `${appUrl}/check-in?t=${token}`;

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });

  res.json({ qr: qrDataUrl, token, expiresIn: secondsUntilNext() });
});

export default router;
