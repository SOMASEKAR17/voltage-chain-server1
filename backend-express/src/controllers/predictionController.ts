import { RequestHandler } from 'express';
import * as listingService from '../services/listingService';
import * as batteryService from '../services/batteryService';
import * as questionnaireService from '../services/questionnaireService';
import * as predictionService from '../services/predictionService';


export const getPredictRul: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const listingId = Array.isArray(id) ? id[0] : id;
        if (!listingId) {
            return res.status(400).json({ error: 'listing id is required' });
        }

        const listing = await listingService.getListingById(listingId);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        if (!listing.battery_id) {
            return res.status(400).json({
                error: 'Listing has no battery. Add a battery to run prediction.',
            });
        }

        const battery = await batteryService.getBatteryStatus(listing.battery_id);
        if (!battery) {
            return res.status(404).json({ error: 'Battery not found' });
        }

        const survey = await questionnaireService.getQuestionnaireByListingId(listingId);
        if (!survey) {
            return res.status(400).json({
                error: 'Questionnaire required. Submit a questionnaire for this listing before running prediction.',
            });
        }

        const result = await predictionService.predictRulForListing(battery, survey);
        res.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Prediction failed';
        return res.status(400).json({ error: message });
    }
};

/**
 * GET /api/predict/health
 * Proxies FastAPI health check (useful to verify prediction service is up).
 */
export const getPredictionHealth: RequestHandler = async (_req, res, next) => {
    try {
        const health = await predictionService.checkPredictionApiHealth();
        if (!health) {
            return res.status(503).json({
                status: 'unavailable',
                message: 'Battery Prediction API is not reachable',
            });
        }
        res.json(health);
    } catch {
        res.status(503).json({
            status: 'unavailable',
            message: 'Battery Prediction API is not reachable',
        });
    }
};
