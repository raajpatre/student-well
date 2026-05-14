import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import managerRoutes from './routes/manager.routes';
import counsellorRoutes from './routes/counsellor.routes';
import studentRoutes from './routes/student.routes';
import checkinRoutes from './routes/checkin.routes';
import chatRoutes from './routes/chat.routes';
import spacesRoutes from './routes/spaces.routes';
import { authMiddleware } from './middleware/auth';
import { requireRole } from './middleware/requireRole';
import { errorHandler } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimiters';
import { startPassiveSweepJob } from './jobs/passiveSweep';
import { initNotificationJobs } from './jobs/notificationJobs';
import notificationRoutes from './routes/notification.routes';
import newtonStudentRouter, { managerNewtonSyncStatus } from './routes/newton';
import { logger } from './lib/logger';

const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin (curl, health checks) and any localhost/127.0.0.1 port in dev
    if (!origin) return cb(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return cb(null, true);
    if (origin === env.CLIENT_URL) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(globalLimiter);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/manager', authMiddleware, requireRole('manager'), managerRoutes);
app.use('/api/counsellor', authMiddleware, requireRole('counsellor'), counsellorRoutes);
app.use('/api/student', authMiddleware, requireRole('student'), studentRoutes);
app.use('/api/checkins', authMiddleware, requireRole('student'), checkinRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/spaces', authMiddleware, requireRole('student'), spacesRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/student/newton', authMiddleware, requireRole('student'), newtonStudentRouter);
app.get('/api/manager/newton/sync-status', authMiddleware, requireRole('manager'), managerNewtonSyncStatus);

app.use(errorHandler);

const port = env.PORT || 3001;

app.listen(port, () => {
  logger.info({ port }, 'Server listening');
  startPassiveSweepJob();
  initNotificationJobs();
});
