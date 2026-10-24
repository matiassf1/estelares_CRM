import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  MembershipError,
  suspend,
  terminate,
  reactivate,
  cancelPeriod,
  getMembershipState,
  getMembershipHistory,
} from '../services/membership';

const router = Router();
// Sólo admin. El portero registra ingresos, no administra membresías.
router.use(authMiddleware, requireRole('admin'));

/** Traduce los errores de dominio a HTTP; cualquier otro sigue al handler global. */
function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof MembershipError) {
        res.status(err.status).json({ error: err.message, details: err.details });
        return;
      }
      next(err);
    }
  };
}

router.post(
  '/members/:id/suspend',
  handle(async (req, res) => {
    const period = await suspend({
      memberId: req.params.id,
      effectiveFrom: req.body.effective_from,
      effectiveUntil: req.body.effective_until ?? null,
      reason: req.body.reason,
      actorId: req.user!.id,
    });
    const state = await getMembershipState(req.params.id);
    res.status(201).json({ period, state });
  })
);

router.post(
  '/members/:id/terminate',
  handle(async (req, res) => {
    const period = await terminate({
      memberId: req.params.id,
      effectiveFrom: req.body.effective_from,
      reason: req.body.reason,
      actorId: req.user!.id,
    });
    const state = await getMembershipState(req.params.id);
    res.status(201).json({ period, state });
  })
);

router.post(
  '/members/:id/reactivate',
  handle(async (req, res) => {
    const result = await reactivate({
      memberId: req.params.id,
      effectiveFrom: req.body.effective_from,
      reason: req.body.reason ?? null,
      actorId: req.user!.id,
    });
    const state = await getMembershipState(req.params.id);
    res.json({ ...result, state });
  })
);

router.post(
  '/membership-periods/:periodId/cancel',
  handle(async (req, res) => {
    await cancelPeriod(req.params.periodId, req.user!.id, req.body.reason);
    res.json({ ok: true });
  })
);

router.get(
  '/members/:id/membership',
  handle(async (req, res) => {
    res.json(await getMembershipState(req.params.id));
  })
);

router.get(
  '/members/:id/membership/history',
  handle(async (req, res) => {
    // Valida que el jugador exista antes de devolver un historial vacío.
    await getMembershipState(req.params.id);
    res.json(await getMembershipHistory(req.params.id));
  })
);

export default router;
