import { Router } from 'express';
import { getListings, getListingById, buyListing, findListing } from '../controllers/listingController';

const router = Router();
router.get('/', getListings);
router.get('/find', findListing);
router.get('/:id', getListingById);
router.post('/:id/buy', buyListing);

export default router;
