import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@nirmalmandi/shared';
import { paymentsRouter } from './routes/payments';
import { adminPayoutsRouter } from './routes/adminPayouts';

const app = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3005;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'] }));

// Raw body for webhook signature verification
app.use('/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'payment-service' }));
app.use('/payments', paymentsRouter);
app.use('/admin/payouts', adminPayoutsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error in payment-service', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`Payment service running on :${PORT}`));
export default app;
