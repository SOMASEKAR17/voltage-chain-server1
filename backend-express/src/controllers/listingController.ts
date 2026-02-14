import { RequestHandler } from 'express';
import * as listingService from '../services/listingService';
import * as questionnaireService from '../services/questionnaireService';

/** GET /api/listings/seed-seller-id - return a valid seller UUID for testing POST /draft (sample.sql). */
export const getSeedSellerId: RequestHandler = async (_req, res, next) => {
    try {
        const sellerId = await listingService.getSeedSellerId();
        if (!sellerId) {
            return res.status(404).json({ error: 'No users in database. Load sample.sql first.' });
        }
        res.json({ seller_id: sellerId });
    } catch (err) {
        next(err);
    }
};

export const getListings: RequestHandler = async (req, res, next) => {
    try {
        const listings = await listingService.getListings();
        res.json({ data: listings });
    }
    catch (err) {
        next(err);
    }
};
// ... existing code ...
export const findListing: RequestHandler = async (req, res, next) => {
    try {
        const battery_code = Array.isArray(req.query.battery_code) ? req.query.battery_code[0] : req.query.battery_code;
        const battery_id = Array.isArray(req.query.battery_id) ? req.query.battery_id[0] : req.query.battery_id;

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

/**
 * POST /api/listings/create-draft
 * Create a draft listing from questionnaire data (for predictions)
 */
export const createDraft: RequestHandler = async (req, res, next) => {
    try {
        const { seller_id, questionnaire } = req.body;

        if (!seller_id || !questionnaire) {
            return res.status(400).json({ error: 'seller_id and questionnaire data are required' });
        }

        const listingId = await listingService.createDraftListing(seller_id);
        const savedSurvey = await questionnaireService.createQuestionnaire(listingId, questionnaire);

        res.status(201).json({
            success: true,
            listing_id: listingId,
            questionnaire: savedSurvey
        });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/listings/:id
 */
export const deleteListing: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const listingId = Array.isArray(id) ? id[0] : id;
        const result = await listingService.deleteListing(listingId);

        if (!result) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        res.json({ success: true, message: 'Listing deleted successfully' });
    } catch (err) {
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
