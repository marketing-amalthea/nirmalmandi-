import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@nirmalmandi/shared';
import { analyticsRouter } from './routes/analytics';
import { scheduledJobs } from './engines/scheduler';
import { adminStatsRouter } from './routes/adminStats';
import { adminSettingsRouter } from './routes/adminSettings';

const app = express();
const PORT = process.env.ANALYTICS_SERVICE_PORT || 3008;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'analytics-service' }));
app.use('/analytics', analyticsRouter);
app.use('/admin/stats', adminStatsRouter);
app.use('/admin/settings', adminSettingsRouter);

// Start scheduled analytics jobs
scheduledJobs.start();

app.listen(PORT, () => logger.info(`Analytics service running on :${PORT}`));
export default app;
