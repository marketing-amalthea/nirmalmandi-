import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@nirmalmandi/shared';
import { listingsRouter } from './routes/listings';
import { sectorsRouter } from './routes/sectors';
import { imagesRouter } from './routes/images';
import { adminInventoryRouter } from './routes/adminInventory';
import { adminCategoriesRouter } from './routes/adminCategories';
import { sellerRouter } from './routes/seller';
import { buyerRouter } from './routes/buyer';

const app = express();
const PORT = process.env.INVENTORY_SERVICE_PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'inventory-service' }));
app.use('/listings', listingsRouter);
app.use('/sectors', sectorsRouter);
app.use('/images', imagesRouter);
app.use('/seller', sellerRouter);
app.use('/buyer', buyerRouter);
app.use('/admin/inventory', adminInventoryRouter);
app.use('/admin/categories', adminCategoriesRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Inventory service error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`Inventory service running on :${PORT}`));
export default app;
