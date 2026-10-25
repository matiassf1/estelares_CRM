import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import authRoutes from './routes/auth';
import checkinRoutes from './routes/checkin';
import porteroRoutes from './routes/portero';
import adminRoutes from './routes/admin';
import adminMembershipRoutes from './routes/admin-membership';
import adminUsersRoutes from './routes/admin-users';
import adminDashboardRoutes from './routes/admin-dashboard';
import parkingRoutes from './routes/parking';
import categoriasRoutes from './routes/categorias';
import trainingSchedulesRouter from './routes/training-schedules';
import analyticsRouter from './routes/analytics';
import assocAuthRouter from './routes/association/auth';
import assocMatchesRouter from './routes/association/matches';
import assocPlayersRouter from './routes/association/players';

export interface CreateAppOptions {
  /** Sirve el bundle del frontend y el catch-all de la SPA. Sólo en producción. */
  serveStatic?: boolean;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/check-in', checkinRoutes);
  app.use('/api/portero', porteroRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/admin', adminMembershipRoutes);
  app.use('/api/admin', adminDashboardRoutes);
  app.use('/api/admin', adminUsersRoutes);
  app.use('/api/parking', parkingRoutes);
  app.use('/api/categorias', categoriasRoutes);
  app.use('/api/admin/training-schedules', trainingSchedulesRouter);
  app.use('/api/admin/analytics', analyticsRouter);
  app.use('/api/assoc/auth', assocAuthRouter);
  app.use('/api/assoc/matches', assocMatchesRouter);
  app.use('/api/assoc/players', assocPlayersRouter);

  // SPA estática. Va después de las rutas de API y antes del error handler.
  if (options.serveStatic) {
    const frontendPath = path.join(__dirname, '../public');
    app.use(express.static(frontendPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }

  // Global error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
