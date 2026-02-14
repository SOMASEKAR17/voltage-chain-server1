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

/**
 * GET /api/listings/find?battery_code=BAT-001
 * or GET /api/listings/find?battery_id=<uuid>
 * Find listing ID by battery code or battery ID (useful for frontend)
 */
export const findListing: RequestHandler = async (req, res, next) => {
    try {
        const { battery_code, battery_id } = req.query;

        if (!battery_code && !battery_id) {
            return res.status(400).json({
                error: 'Either battery_code or battery_id query parameter is required',
                example: '/api/listings/find?battery_code=BAT-001'
            });
        }

        let result: { listing_id: string; battery_id: string } | null = null;

        if (battery_code) {
            result = await listingService.getListingByBatteryCode(battery_code as string);
        } else if (battery_id) {
            const listingId = await listingService.getListingByBatteryId(battery_id as string);
            if (listingId) {
                result = { listing_id: listingId, battery_id: battery_id as string };
            }
        }

        if (!result) {
            return res.status(404).json({
                error: 'No listing found for the provided battery',
                battery_code: battery_code || undefined,
                battery_id: battery_id || undefined
            });
        }

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        next(err);
    }
};
