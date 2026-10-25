import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Express 4 no captura las excepciones de un handler `async`: la promesa
 * rechazada no llega al error middleware, la request queda colgada y Node
 * la convierte en un unhandledRejection, que por default mata el proceso.
 *
 * Envolver cada ruta async con esto reenvía el error a next(), que lo lleva
 * al error handler global de app.ts. Express 5 lo hace solo; mientras tanto,
 * esto es explícito y no agrega dependencias.
 */
export function asyncHandler<
  Req extends Request = Request,
  Res extends Response = Response
>(
  fn: (req: Req, res: Res, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as Req, res as Res, next)).catch(next);
  };
}
