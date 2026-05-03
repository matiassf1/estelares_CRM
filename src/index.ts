import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { initDb } from './db';
import authRoutes from './routes/auth';
import checkinRoutes from './routes/checkin';
import porteroRoutes from './routes/portero';
import adminRoutes from './routes/admin';
import parkingRoutes from './routes/parking';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/check-in', checkinRoutes);
app.use('/api/portero', porteroRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/parking', parkingRoutes);

const frontendPath = path.join(__dirname, '../public');
app.use(express.static(frontendPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global error handler — evita que stack traces lleguen al cliente
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function start() {
  await initDb();
  app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
}

start().catch(console.error);
