import { Router } from 'express';
import {
    getPredictionHealth,
    getHealthStatus,
    postPredictRul,
    postPredictCapacitySurvey,
    postPredictFull
} from '../controllers/predictionController';

const router = Router();

// Health check routes
router.get('/health', getPredictionHealth);
router.get('/health-status/:soh', getHealthStatus);

// Prediction routes (POST with body data)
router.post('/predict-rul', postPredictRul);
router.post('/predict-capacity-survey', postPredictCapacitySurvey);
router.post('/predict-full', postPredictFull);

export default router;
