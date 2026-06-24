// rebuild trigger: multi-secret JWT auth
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@nirmalmandi/shared';
import { listingsRouter } from './routes/listings';
import { sectorsRouter } from './routes/sectors';
import { aiListingRouter } from './routes/aiListing';
import { imagesRouter } from './routes/images';
import { adminInventoryRouter } from './routes/adminInventory';
import { adminCategoriesRouter } from './routes/adminCategories';
import { sellerRouter } from './routes/seller';
import { buyerRouter } from './routes/buyer';
import { storefrontRouter } from './routes/storefront';

const app = express();
const PORT = process.env.INVENTORY_SERVICE_PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'inventory-service' }));

// Temporary debug — shows which secret is active (masked) + validates a token
app.post('/debug-auth', (req, res) => {
  const jwt = require('jsonwebtoken');
  const secret = (process.env.INTERNAL_SERVICE_SECRET || '').replace(/['"]/g, '').trim();
  const fallback = 'nm-jwt-secret-2026';
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const secretMasked = secret ? secret.slice(0, 4) + '***' + secret.slice(-4) : '(not set)';

  const results: Record<string, unknown> = { secret_present: !!secret, secret_masked: secretMasked };

  for (const [label, s] of [['env_secret', secret || fallback], ['fallback', fallback]] as [string, string][]) {
    try {
      const decoded = jwt.verify(token, s, { algorithms: ['HS256'] });
      results[label] = { valid: true, payload: decoded };
      break;
    } catch (e: unknown) {
      results[label] = { valid: false, error: (e as Error).message };
    }
  }
  res.json(results);
});
app.use('/listings', listingsRouter);
app.use('/sectors', sectorsRouter);
app.use('/images', imagesRouter);
app.use('/seller', sellerRouter);
app.use('/buyer', buyerRouter);
app.use('/storefront', storefrontRouter);
app.use('/admin/inventory', adminInventoryRouter);
app.use('/admin/categories', adminCategoriesRouter);
app.use('/ai', aiListingRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Inventory service error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`Inventory service running on :${PORT}`));
export default app;
