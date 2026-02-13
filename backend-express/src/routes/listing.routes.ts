import { Router } from 'express';
import { getListings, getListingById } from '../controllers/listingController';
import { getPredictRul } from '../controllers/predictionController';
const router = Router();
router.get('/', getListings);
router.get('/:id/predict-rul', getPredictRul);
router.get('/:id', getListingById);
export default router;
