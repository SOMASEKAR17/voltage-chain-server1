import { RequestHandler } from 'express';
import * as questionnaireService from '../services/questionnaireService';
import * as listingService from '../services/listingService';
import { QuestionnaireData } from '../types/api.types';
export const createQuestionnaire: RequestHandler = async (req, res, next) => {
    try {
        const { listing_id } = req.params;
        const listingId = Array.isArray(listing_id) ? listing_id[0] : listing_id;
        const questionnaire = req.body as QuestionnaireData;
        if (!listingId) {
            return res.status(400).json({ error: 'listing_id is required' });
        }
        const required = ['brand_model', 'initial_capacity_ah', 'current_capacity_ah', 'years_owned', 'primary_application', 'avg_daily_usage', 'charging_frequency_per_week', 'typical_charge_level'];
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
        res.status(201).json({ data: result });
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
