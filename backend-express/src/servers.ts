import express from 'express';
import dotenv from 'dotenv';
import path from 'path';

// placeholder route/middleware imports (create files as needed)
import batteryRoutes from './routes/battery.routes';
import ocrRoutes from './routes/ocr.routes';
import errorHandler from './middleware/errorHandler';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();

app.use(express.json());
app.use('/api/battery', batteryRoutes);
app.use('/api/ocr', ocrRoutes);
app.use(errorHandler);

const port = Number(process.env.PORT || '3000');
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});

export default app;
