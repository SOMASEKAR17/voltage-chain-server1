import { RequestHandler } from 'express';
import * as questionnaireService from '../services/questionnaireService';
import * as listingService from '../services/listingService';
import * as batteryService from '../services/batteryService';
import * as predictionService from '../services/predictionService';
import { QuestionnaireData } from '../types/api.types';

export const createQuestionnaire: RequestHandler = async (req, res, next) => {
    try {
        const { listing_id } = req.params;
        const listingId = Array.isArray(listing_id) ? listing_id[0] : listing_id;
        const predictVal = Array.isArray(req.query.predict) ? req.query.predict[0] : req.query.predict;
        const runPrediction = predictVal === 'true' || predictVal === '1';
        const questionnaire = req.body as QuestionnaireData;
        if (!listingId) {
            return res.status(400).json({ error: 'listing_id is required' });
        }
        const required = ['brand_model', 'initial_capacity', 'current_capacity', 'years_owned', 'primary_application', 'avg_daily_usage', 'charging_frequency_per_week', 'typical_charge_level'];
        const missing = required.filter((k) => questionnaire[k as keyof QuestionnaireData] == null || questionnaire[k as keyof QuestionnaireData] === '');
        if (missing.length > 0) {
            return res.status(400).json({ error: 'Missing required fields', required: missing });
        }
        const listing = await listingService.getListingById(listingId);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        const existing = await questionnaireService.getQuestionnaireByListingId(listingId);
        let result;
        if (existing) {
            result = await questionnaireService.updateQuestionnaire(listingId, questionnaire);
        }
        else {
            result = await questionnaireService.createQuestionnaire(listingId, questionnaire);
        }
        const payload: { data: typeof result; prediction?: unknown } = { data: result };
        if (runPrediction && listing.battery_id && result) {
            try {
                const battery = await batteryService.getBatteryStatus(listing.battery_id);
                if (battery) {
                    const prediction = await predictionService.predictRulForListing(battery, result);
                    payload.prediction = prediction;
                    await listingService.upsertAiEvaluation(listingId, {
                        soh_percentage: prediction.health_analysis.soh_percentage,
                        health_status: prediction.health_analysis.health_status,
                        health_description: prediction.health_analysis.health_description,
                        degradation_factor_percent: prediction.health_analysis.degradation_factor_percent,
                    });
                }
            } catch (predErr) {
                payload.prediction = { error: predErr instanceof Error ? predErr.message : 'Prediction failed' };
            }
        }
        res.status(201).json(payload);
    }
    catch (err) {
        next(err);
    }
};
export const getQuestionnaire: RequestHandler = async (req, res, next) => {
    try {
        const { listing_id } = req.params;
        const listingId = Array.isArray(listing_id) ? listing_id[0] : listing_id;
        if (!listingId) {
            return res.status(400).json({ error: 'listing_id is required' });
        }
        const questionnaire = await questionnaireService.getQuestionnaireByListingId(listingId);
        if (!questionnaire) {
            return res.status(404).json({ error: 'Questionnaire not found' });
        }
        res.json({ data: questionnaire });
    }
    catch (err) {
        next(err);
    }
};
