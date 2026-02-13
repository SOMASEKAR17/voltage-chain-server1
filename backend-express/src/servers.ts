import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import batteryRoutes from './routes/battery.routes';
import ocrRoutes from './routes/ocr.routes';
import listingRoutes from './routes/listing.routes';
import questionnaireRoutes from './routes/questionnaire.routes';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
if (!process.env.DATABASE_URL && process.cwd().endsWith('backend-express')) {
  dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
}

const app = express();

// Basic request logger
app.use(express.json());
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

app.use('/api/battery', batteryRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/questionnaire', questionnaireRoutes);
app.use(errorHandler);

const port = Number(process.env.PORT || '3000');
const server = app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});

process.on('uncaughtException', (err: any) => {
  logger.error(`uncaughtException: ${err?.stack || err}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`unhandledRejection: ${reason}`);
});

export default app;
