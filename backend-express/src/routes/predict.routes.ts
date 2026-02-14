import { Router } from 'express';
import { getPredictionHealth, getHealthStatus } from '../controllers/predictionController';

const router = Router();
router.get('/health', getPredictionHealth);
router.get('/health-status/:soh', getHealthStatus);
export default router;
