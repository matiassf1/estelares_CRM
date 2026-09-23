import { Router } from 'express';
import QRCode from 'qrcode';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getCurrentToken, secondsUntilNext } from '../utils/token';

const router = Router();

router.get('/qr', authMiddleware, requireRole('admin', 'portero'), async (req, res) => {
  const token = getCurrentToken();
  const appUrl = `${req.protocol}://${req.get('host')}`;
  const url = `${appUrl}/check-in?t=${token}`;

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });

  res.json({ qr: qrDataUrl, token, expiresIn: secondsUntilNext() });
});

router.get('/carnet-qr', authMiddleware, requireRole('member'), async (req, res) => {
  const memberId = req.user!.id;
  const qrDataUrl = await QRCode.toDataURL(memberId, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
  res.json({ qr: qrDataUrl });
});

export default router;
