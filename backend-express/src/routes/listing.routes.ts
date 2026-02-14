import { Router } from 'express';
import { getListings, getListingById } from '../controllers/listingController';
import {
    getPredictRul,
    getPredictCapacitySurvey,
    getPredictFull,
} from '../controllers/predictionController';
const router = Router();
router.get('/', getListings);
router.get('/:id/predict-full', getPredictFull);
router.get('/:id/predict-capacity-survey', getPredictCapacitySurvey);
router.get('/:id/predict-rul', getPredictRul);
router.get('/:id', getListingById);
export default router;
