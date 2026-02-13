import { query } from '../config/postgres';
import { QuestionnaireData } from '../types/api.types';

/** Matches public.user_surveys schema. */
export interface UserSurvey {
    id: string;
    listing_id: string;
    brand_model: string;
    initial_capacity_ah: number;
    current_capacity_ah: number;
    years_owned: number;
    primary_application: string;
    avg_daily_usage: string;
    charging_frequency_per_week: number;
    typical_charge_level: string;
    avg_temperature_c?: number;
    created_at: Date;
}

const COLS = `id, listing_id, brand_model, initial_capacity_ah, current_capacity_ah,
  years_owned, primary_application, avg_daily_usage, charging_frequency_per_week,
  typical_charge_level, avg_temperature_c, created_at`;

const INS_COLS = `listing_id, brand_model, initial_capacity_ah, current_capacity_ah,
  years_owned, primary_application, avg_daily_usage, charging_frequency_per_week,
  typical_charge_level, avg_temperature_c`;

function rowToSurvey(row: Record<string, unknown>): UserSurvey {
    return {
        id: row.id as string,
        listing_id: row.listing_id as string,
        brand_model: row.brand_model as string,
        initial_capacity_ah: Number(row.initial_capacity_ah),
        current_capacity_ah: Number(row.current_capacity_ah),
        years_owned: Number(row.years_owned),
        primary_application: row.primary_application as string,
        avg_daily_usage: row.avg_daily_usage as string,
        charging_frequency_per_week: Number(row.charging_frequency_per_week),
        typical_charge_level: row.typical_charge_level as string,
        avg_temperature_c: row.avg_temperature_c != null ? Number(row.avg_temperature_c) : undefined,
        created_at: row.created_at as Date,
    };
}

export async function createQuestionnaire(listingId: string, q: QuestionnaireData): Promise<UserSurvey> {
    const result = await query(`INSERT INTO public.user_surveys (${INS_COLS})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${COLS}`, [
        listingId, q.brand_model, q.initial_capacity_ah, q.current_capacity_ah,
        q.years_owned, q.primary_application, q.avg_daily_usage, q.charging_frequency_per_week,
        q.typical_charge_level, q.avg_temperature_c ?? null,
    ]);
    return rowToSurvey(result.rows[0] as Record<string, unknown>);
}

export async function getQuestionnaireByListingId(listingId: string): Promise<UserSurvey | null> {
    const result = await query(`SELECT ${COLS} FROM public.user_surveys WHERE listing_id = $1 LIMIT 1`, [listingId]);
    if (result.rows.length === 0) return null;
    return rowToSurvey(result.rows[0] as Record<string, unknown>);
}

export async function updateQuestionnaire(listingId: string, q: QuestionnaireData): Promise<UserSurvey | null> {
    const result = await query(`UPDATE public.user_surveys SET
     brand_model = COALESCE($2, brand_model),
     initial_capacity_ah = COALESCE($3, initial_capacity_ah),
     current_capacity_ah = COALESCE($4, current_capacity_ah),
     years_owned = COALESCE($5, years_owned),
     primary_application = COALESCE($6, primary_application),
     avg_daily_usage = COALESCE($7, avg_daily_usage),
     charging_frequency_per_week = COALESCE($8, charging_frequency_per_week),
     typical_charge_level = COALESCE($9, typical_charge_level),
     avg_temperature_c = COALESCE($10, avg_temperature_c)
     WHERE listing_id = $1 RETURNING ${COLS}`, [
        listingId, q.brand_model ?? null, q.initial_capacity_ah ?? null, q.current_capacity_ah ?? null,
        q.years_owned ?? null, q.primary_application ?? null, q.avg_daily_usage ?? null,
        q.charging_frequency_per_week ?? null, q.typical_charge_level ?? null,
        q.avg_temperature_c ?? null,
    ]);
    if (result.rows.length === 0) return null;
    return rowToSurvey(result.rows[0] as Record<string, unknown>);
}
