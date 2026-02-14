import { RequestHandler } from 'express';
import * as listingService from '../services/listingService';
export const getListings: RequestHandler = async (req, res, next) => {
    try {
        const listings = await listingService.getListings();
        res.json({ data: listings });
    }
    catch (err) {
        next(err);
    }
};
export const getListingById: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const listingId = Array.isArray(id) ? id[0] : id;
        const listing = await listingService.getListingById(listingId);
        if (!listing)
            return res.status(404).json({ error: 'Listing not found' });
        res.json({ data: listing });
    }
    catch (err) {
        next(err);
    }
};

export const buyListing: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const listingId = Array.isArray(id) ? id[0] : id;
        const buyer_wallet = req.body.buyer_wallet;

        if (!listingId || !buyer_wallet) {
            return res.status(400).json({ error: 'buyer_wallet required' });
        }

        const result = await listingService.buyListing(listingId, buyer_wallet);

        res.json({
            success: true,
            message: 'Listing purchased successfully',
            data: result
        });
    } catch (err) {
        next(err);
    }
};
