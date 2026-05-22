import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@nirmalmandi/shared';
import { ordersRouter } from './routes/orders';
import { cartRouter } from './routes/cart';
import { adminOrdersRouter } from './routes/adminOrders';
import { adminDisputesRouter } from './routes/adminDisputes';

const app = express();
const PORT = process.env.ORDER_SERVICE_PORT || 3003;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'] }));
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'order-service' }));
app.use('/orders', ordersRouter);
app.use('/cart', cartRouter);
app.use('/admin/transactions', adminOrdersRouter);
app.use('/admin/disputes', adminDisputesRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error in order-service', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`Order service running on :${PORT}`));
export default app;
