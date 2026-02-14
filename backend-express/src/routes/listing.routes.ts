import { Router } from 'express';
import {
    getListings,
    getListingById,
    findListing,
    getSeedSellerId,
    createDraft,
    deleteListing,
    buyListing,
} from '../controllers/listingController';
import {
    getPredictRul,
    getPredictCapacitySurvey,
    getPredictFull,
} from '../controllers/predictionController';
const router = Router();
router.get('/', getListings);
router.get('/find', findListing);
router.get('/seed-seller-id', getSeedSellerId);
router.post('/draft', createDraft);
router.post('/create-draft', createDraft);
router.get('/:id/predict-full', getPredictFull);
router.get('/:id/predict-capacity-survey', getPredictCapacitySurvey);
router.get('/:id/predict-rul', getPredictRul);
router.get('/:id', getListingById);
router.post('/:id/buy', buyListing);
router.delete('/:id', deleteListing);
export default router;
