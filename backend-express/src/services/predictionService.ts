import {
    PredictRulRequest,
    PredictRulResponse,
    PredictCapacitySurveyRequest,
    CapacityPredictionResponse,
} from '../types/api.types';
import type { Battery } from '../types/battery.types';
import type { UserSurvey } from './questionnaireService';

const PREDICTION_API_BASE = process.env.PREDICTION_API_URL || 'http://localhost:8000';

/**
 * Build FastAPI /api/predict-rul request from listing's battery + questionnaire.
 * Questionnaire takes precedence for capacity and age; battery supplies cycle_count when available.
 */
export function buildPredictRulPayload(
    battery: Battery,
    survey: UserSurvey
): PredictRulRequest {
    const initial_capacity = survey.initial_capacity ?? battery.initial_capacity ?? 0;
    const current_capacity = survey.current_capacity ?? battery.current_capacity ?? 0;
    const age_days = survey.years_owned * 365;
    const cycle_count =
        battery.charging_cycles ??
        Math.round(survey.years_owned * survey.charging_frequency_per_week * 52);
    const ambient_temperature = survey.avg_temperature_c ?? 25;

    return {
        initial_capacity: Number(initial_capacity),
        current_capacity: Number(current_capacity),
        age_days,
        cycle_count: Math.max(0, cycle_count),
        ambient_temperature,
    };
}

/**
 * Call FastAPI GET /api/health-status/{soh_percentage}.
 */
export async function getHealthStatus(
    sohPercentage: number
): Promise<{ soh_percentage: number; health_status: string; health_description: string } | null> {
    try {
        const res = await fetch(
            `${PREDICTION_API_BASE}/api/health-status/${encodeURIComponent(sohPercentage)}`,
            { method: 'GET', headers: { Accept: 'application/json' } }
        );
        if (!res.ok) return null;
        return (await res.json()) as {
            soh_percentage: number;
            health_status: string;
            health_description: string;
        };
    } catch {
        return null;
    }
}

/**
 * Call FastAPI Battery Prediction API health check.
 */
export async function checkPredictionApiHealth(): Promise<{ status: string; message?: string } | null> {
    try {
        const res = await fetch(`${PREDICTION_API_BASE}/api/health`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { status?: string; message?: string };
        return { status: data.status ?? 'ok', message: data.message };
    } catch {
        return null;
    }
}

/**
 * Call FastAPI POST /api/predict-rul and return the JSON response.
 */
export async function predictRul(payload: PredictRulRequest): Promise<PredictRulResponse> {
    const res = await fetch(`${PREDICTION_API_BASE}/api/predict-rul`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();
    let body: unknown;
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Prediction API returned invalid JSON: ${res.status}`);
    }

    if (!res.ok) {
        const detail = (body as { detail?: string | unknown })?.detail;
        const message =
            typeof detail === 'string'
                ? detail
                : Array.isArray(detail)
                  ? (detail as Array<{ msg?: string }>).map((d) => d.msg).join(', ')
                  : 'Prediction request failed';
        throw new Error(message);
    }

    return body as PredictRulResponse;
}

/**
 * Run RUL prediction for a listing using its battery and questionnaire.
 * Requires both battery and questionnaire to be present.
 */
export async function predictRulForListing(
    battery: Battery,
    survey: UserSurvey
): Promise<PredictRulResponse> {
    const payload = buildPredictRulPayload(battery, survey);
    return predictRul(payload);
}

/**
 * Build FastAPI POST /api/predict-capacity-survey request from listing id and survey.
 * Maps our UserSurvey to FastAPI UserSurveyInput (charging_frequency_in_week, avg_temperature).
 */
export function buildSurveyCapacityPayload(
    listingId: string,
    survey: UserSurvey
): PredictCapacitySurveyRequest {
    return {
        listing_id: listingId,
        brand_model: survey.brand_model,
        initial_capacity: Number(survey.initial_capacity),
        years_owned: survey.years_owned,
        primary_application: survey.primary_application as 'E-bike' | 'E-car',
        avg_daily_usage: survey.avg_daily_usage as 'Light' | 'Medium' | 'Heavy',
        charging_frequency_in_week: survey.charging_frequency_per_week,
        typical_charge_level: survey.typical_charge_level as '20-80' | '0-100' | 'Always Full',
        avg_temperature: survey.avg_temperature_c ?? 25,
    };
}

/**
 * Call FastAPI POST /api/predict-capacity-survey (survey-based capacity prediction).
 * Use when you only have survey data and no measured current capacity.
 */
export async function predictCapacityFromSurvey(
    payload: PredictCapacitySurveyRequest
): Promise<CapacityPredictionResponse> {
    const res = await fetch(`${PREDICTION_API_BASE}/api/predict-capacity-survey`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();
    let body: unknown;
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Prediction API returned invalid JSON: ${res.status}`);
    }

    if (!res.ok) {
        const detail = (body as { detail?: string | unknown })?.detail;
        const message =
            typeof detail === 'string' ? detail : 'Capacity prediction request failed';
        throw new Error(message);
    }

    return body as CapacityPredictionResponse;
}

/**
 * Combined workflow (per FastAPI markdown): predict capacity from survey, then run RUL with predicted capacity.
 * Returns both survey capacity prediction and full RUL/health analysis.
 */
export async function predictFullFromSurvey(
    listingId: string,
    survey: UserSurvey
): Promise<{ survey: CapacityPredictionResponse; rul: PredictRulResponse }> {
    const surveyPayload = buildSurveyCapacityPayload(listingId, survey);
    const surveyResult = await predictCapacityFromSurvey(surveyPayload);
    const summary = surveyResult.input_summary;
    const age_days = summary.years_owned * 365;
    const cycle_count = Math.round(
        summary.years_owned * summary.charging_frequency_per_week * 52
    );
    const rulPayload: PredictRulRequest = {
        initial_capacity: summary.initial_capacity_ahr,
        current_capacity: surveyResult.predicted_current_capacity,
        age_days,
        cycle_count: Math.max(0, cycle_count),
        ambient_temperature: summary.avg_temperature_c ?? 25,
    };
    const rulResult = await predictRul(rulPayload);
    return { survey: surveyResult, rul: rulResult };
}
