import { Router } from 'express';
import { getListings, getListingById, buyListing } from '../controllers/listingController';

const router = Router();
router.get('/', getListings);
router.get('/:id', getListingById);
router.post('/:id/buy', buyListing);

export default router;
