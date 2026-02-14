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
        const runPrediction = req.query.predict === 'true' || req.query.predict === '1';
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
                    // Convert UserSurvey to QuestionnaireData format
                    const questionnaireData = {
                        brand_model: result.brand_model,
                        initial_capacity: result.initial_capacity,
                        current_capacity: result.current_capacity,
                        years_owned: result.years_owned,
                        primary_application: result.primary_application as 'E-bike' | 'E-car',
                        avg_daily_usage: result.avg_daily_usage as 'Light' | 'Medium' | 'Heavy',
                        charging_frequency_per_week: result.charging_frequency_per_week,
                        typical_charge_level: result.typical_charge_level as '20-80' | '0-100' | 'Always Full',
                        avg_temperature_c: result.avg_temperature_c
                    };
                    const rulPayload = predictionService.buildPredictRulPayload(
                        questionnaireData,
                        { charging_cycles: battery.charging_cycles }
                    );
                    const prediction = await predictionService.predictRul(rulPayload);
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
