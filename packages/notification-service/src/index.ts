import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@nirmalmandi/shared';
import { notificationsRouter } from './routes/notifications';
import './queue/processor'; // registers the Bull processor

const app = express();
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3006;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'] }));
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));
app.use('/notifications', notificationsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error in notification-service', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`Notification service running on :${PORT}`));
export default app;
