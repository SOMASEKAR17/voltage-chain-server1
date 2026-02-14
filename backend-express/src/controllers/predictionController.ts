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
 * GET /api/listings/:id/predict-capacity-survey
 * Survey-based capacity prediction (FastAPI /api/predict-capacity-survey).
 * Use when only questionnaire data is available; no measured current capacity required.
 */
export const getPredictCapacitySurvey: RequestHandler = async (req, res) => {
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
        const survey = await questionnaireService.getQuestionnaireByListingId(listingId);
        if (!survey) {
            return res.status(400).json({
                error: 'Questionnaire required. Submit a questionnaire for this listing first.',
            });
        }
        const payload = predictionService.buildSurveyCapacityPayload(listingId, survey);
        const result = await predictionService.predictCapacityFromSurvey(payload);
        res.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Capacity prediction failed';
        return res.status(400).json({ error: message });
    }
};

/**
 * GET /api/listings/:id/predict-full
 * Combined workflow: 1) predict current capacity from survey, 2) run RUL with predicted capacity.
 * Returns both survey capacity prediction and full RUL/health/recommendations.
 */
export const getPredictFull: RequestHandler = async (req, res) => {
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
        const survey = await questionnaireService.getQuestionnaireByListingId(listingId);
        if (!survey) {
            return res.status(400).json({
                error: 'Questionnaire required. Submit a questionnaire for this listing first.',
            });
        }
        const result = await predictionService.predictFullFromSurvey(listingId, survey);
        res.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Prediction failed';
        return res.status(400).json({ error: message });
    }
};

/**
 * GET /api/predict/health-status/:soh
 * Proxies FastAPI health-status (SoH 0-100 → category + description).
 */
export const getHealthStatus: RequestHandler = async (req, res) => {
    try {
        const soh = req.params.soh;
        const sohNum = parseFloat(soh);
        if (Number.isNaN(sohNum) || sohNum < 0 || sohNum > 100) {
            return res.status(400).json({ error: 'SoH percentage must be between 0 and 100' });
        }
        const result = await predictionService.getHealthStatus(sohNum);
        if (!result) {
            return res.status(503).json({
                error: 'Battery Prediction API is not reachable',
            });
        }
        res.json(result);
    } catch {
        res.status(503).json({ error: 'Battery Prediction API is not reachable' });
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
