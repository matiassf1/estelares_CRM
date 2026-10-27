import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { MembershipError } from '../services/membership';
import {
  createRequest,
  cancelRequest,
  getPendingRequest,
} from '../services/membershipRequests';

const router = Router();
// Portal del jugador. El administrador tiene su propia bandeja en
// /api/admin/membership-requests y no opera desde acá.
router.use(authMiddleware, requireRole('member'));

/**
 * Traduce los errores de dominio a HTTP y, sobre todo, captura el rechazo de la
 * promesa: sin esto Express 4 deja la request colgada y mata el proceso.
 */
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

router.get(
  '/membership-request',
  handle(async (req, res) => {
    res.json({ request: await getPendingRequest(req.user!.id) });
  })
);

router.post(
  '/membership-request',
  handle(async (req, res) => {
    // El member_id sale SIEMPRE del token y nunca del body: un jugador no puede
    // pedir nada en nombre de otro.
    const request = await createRequest({
      memberId: req.user!.id,
      kind: req.body.kind,
      effectiveFrom: req.body.effective_from,
      effectiveUntil: req.body.effective_until,
      reason: req.body.reason,
    });
    res.status(201).json({ request });
  })
);

router.delete(
  '/membership-request/:id',
  handle(async (req, res) => {
    res.json({ request: await cancelRequest(req.params.id, req.user!.id) });
  })
);

export default router;
