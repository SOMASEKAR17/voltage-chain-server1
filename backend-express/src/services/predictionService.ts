import {
    PredictRulRequest,
    PredictRulResponse,
    PredictCapacitySurveyRequest,
    CapacityPredictionResponse,
    QuestionnaireData,
} from '../types/api.types';

const PREDICTION_API_BASE = process.env.PREDICTION_API_URL || 'http://localhost:8000';

/**
 * Build FastAPI /api/predict-rul request from questionnaire data.
 * Accepts plain questionnaire object with optional battery data.
 */
export function buildPredictRulPayload(
    questionnaire: QuestionnaireData,
    battery?: { charging_cycles?: number }
): PredictRulRequest {
    const initial_capacity = questionnaire.initial_capacity;
    const current_capacity = questionnaire.current_capacity;
    const age_days = questionnaire.years_owned * 365;
    const cycle_count =
        battery?.charging_cycles ??
        Math.round(questionnaire.years_owned * questionnaire.charging_frequency_per_week * 52);
    const ambient_temperature = questionnaire.avg_temperature_c ?? 25;

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
 * Build FastAPI POST /api/predict-capacity-survey request from questionnaire data.
 * Maps QuestionnaireData to FastAPI UserSurveyInput format.
 */
export function buildSurveyCapacityPayload(
    questionnaire: QuestionnaireData,
    listingId?: string
): PredictCapacitySurveyRequest {
    return {
        listing_id: listingId || 'temp-' + Date.now(), // Use temporary ID if not provided
        brand_model: questionnaire.brand_model,
        initial_capacity: Number(questionnaire.initial_capacity),
        years_owned: questionnaire.years_owned,
        primary_application: questionnaire.primary_application as 'E-bike' | 'E-car',
        avg_daily_usage: questionnaire.avg_daily_usage as 'Light' | 'Medium' | 'Heavy',
        charging_frequency_in_week: questionnaire.charging_frequency_per_week,
        typical_charge_level: questionnaire.typical_charge_level as '20-80' | '0-100' | 'Always Full',
        avg_temperature: questionnaire.avg_temperature_c ?? 25,
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
 * Combined workflow: predict capacity from survey, then run RUL with predicted capacity.
 * Returns both survey capacity prediction and full RUL/health analysis.
 * Accepts plain questionnaire data (no listing ID required).
 */
export async function predictFullFromSurvey(
    questionnaire: QuestionnaireData,
    listingId?: string
): Promise<{ survey: CapacityPredictionResponse; rul: PredictRulResponse }> {
    const surveyPayload = buildSurveyCapacityPayload(questionnaire, listingId);
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
