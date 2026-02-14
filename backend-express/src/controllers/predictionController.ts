import { RequestHandler } from 'express';
import * as predictionService from '../services/predictionService';
import {
    PredictRulRequestBody,
    PredictCapacitySurveyRequestBody,
    PredictFullRequestBody,
} from '../types/api.types';

/**
 * POST /api/predict/predict-rul
 * RUL prediction from questionnaire data (accepts body with questionnaire + optional battery data).
 */
export const postPredictRul: RequestHandler = async (req, res, next) => {
    try {
        const body = req.body as PredictRulRequestBody;

        if (!body.questionnaire) {
            return res.status(400).json({ error: 'questionnaire data is required in request body' });
        }

        // Validate required questionnaire fields
        const q = body.questionnaire;
        if (!q.brand_model || !q.initial_capacity || !q.current_capacity ||
            q.years_owned === undefined || !q.primary_application ||
            !q.avg_daily_usage || !q.charging_frequency_per_week || !q.typical_charge_level) {
            return res.status(400).json({
                error: 'Missing required questionnaire fields',
                required: ['brand_model', 'initial_capacity', 'current_capacity', 'years_owned',
                    'primary_application', 'avg_daily_usage', 'charging_frequency_per_week',
                    'typical_charge_level']
            });
        }

        const payload = predictionService.buildPredictRulPayload(
            body.questionnaire,
            body.battery
        );
        const result = await predictionService.predictRul(payload);
        res.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Prediction failed';
        return res.status(400).json({ error: message });
    }
};

/**
 * POST /api/predict/predict-capacity-survey
 * Survey-based capacity prediction (FastAPI /api/predict-capacity-survey).
 * Accepts questionnaire data in request body.
 */
export const postPredictCapacitySurvey: RequestHandler = async (req, res) => {
    try {
        const questionnaire = req.body as PredictCapacitySurveyRequestBody;

        // Validate required fields
        if (!questionnaire.brand_model || !questionnaire.initial_capacity ||
            questionnaire.years_owned === undefined || !questionnaire.primary_application ||
            !questionnaire.avg_daily_usage || !questionnaire.charging_frequency_per_week ||
            !questionnaire.typical_charge_level) {
            return res.status(400).json({
                error: 'Missing required questionnaire fields',
                required: ['brand_model', 'initial_capacity', 'years_owned',
                    'primary_application', 'avg_daily_usage', 'charging_frequency_per_week',
                    'typical_charge_level']
            });
        }

        const payload = predictionService.buildSurveyCapacityPayload(questionnaire);
        const result = await predictionService.predictCapacityFromSurvey(payload);
        res.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Capacity prediction failed';
        return res.status(400).json({ error: message });
    }
};

/**
 * POST /api/predict/predict-full
 * Combined workflow: 1) predict current capacity from survey, 2) run RUL with predicted capacity.
 * Returns both survey capacity prediction and full RUL/health/recommendations.
 * Accepts questionnaire data in request body.
 */
export const postPredictFull: RequestHandler = async (req, res) => {
    try {
        const questionnaire = req.body as PredictFullRequestBody;

        // Validate required fields
        if (!questionnaire.brand_model || !questionnaire.initial_capacity ||
            questionnaire.years_owned === undefined || !questionnaire.primary_application ||
            !questionnaire.avg_daily_usage || !questionnaire.charging_frequency_per_week ||
            !questionnaire.typical_charge_level) {
            return res.status(400).json({
                error: 'Missing required questionnaire fields',
                required: ['brand_model', 'initial_capacity', 'years_owned',
                    'primary_application', 'avg_daily_usage', 'charging_frequency_per_week',
                    'typical_charge_level']
            });
        }

        const result = await predictionService.predictFullFromSurvey(questionnaire);
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
        const sohParam = req.params.soh;
        const soh = Array.isArray(sohParam) ? sohParam[0] : sohParam;
        const sohNum = parseFloat(soh ?? '');
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
