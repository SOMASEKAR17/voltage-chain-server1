import { Router } from 'express';
import { getPredictionHealth } from '../controllers/predictionController';

const router = Router();
router.get('/health', getPredictionHealth);
export default router;
