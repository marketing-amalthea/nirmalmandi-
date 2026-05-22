import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@nirmalmandi/shared';
import { shipmentsRouter } from './routes/shipments';
import { freightRouter } from './routes/freight';

const app = express();
const PORT = process.env.LOGISTICS_SERVICE_PORT || 3007;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'logistics-service' }));
app.use('/shipments', shipmentsRouter);
app.use('/freight', freightRouter);

app.listen(PORT, () => logger.info(`Logistics service running on :${PORT}`));
export default app;
