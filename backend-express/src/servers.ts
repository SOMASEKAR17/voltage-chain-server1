import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import batteryRoutes from './routes/battery.routes';
import ocrRoutes from './routes/ocr.routes';
import listingRoutes from './routes/listing.routes';
import { errorHandler } from './middleware/errorHandler';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
if (!process.env.DATABASE_URL && process.cwd().endsWith('backend-express')) {
  dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
}

const app = express();

app.use(express.json());
app.use('/api/battery', batteryRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/listings', listingRoutes);
app.use(errorHandler);

const port = Number(process.env.PORT || '3000');
app.listen(port, () => {
  // server started
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});

export default app;
