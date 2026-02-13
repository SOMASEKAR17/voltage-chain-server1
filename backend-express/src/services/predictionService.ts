import { PredictRulRequest, PredictRulResponse } from '../types/api.types';
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
