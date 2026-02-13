import { query } from '../config/postgres';
import { QuestionnaireData } from '../types/api.types';
export interface UsageSurvey {
    id: string;
    listing_id: string;
    years_used?: number;
    first_owner?: boolean;
    use_case?: string;
    charging_frequency?: string;
    created_at: Date;
}
export async function createQuestionnaire(listingId: string, questionnaire: QuestionnaireData): Promise<UsageSurvey> {
    const result = await query<{
        id: string;
        listing_id: string;
        years_used: number | null;
        first_owner: boolean | null;
        use_case: string | null;
        charging_frequency: string | null;
        created_at: Date;
    }>(`INSERT INTO public.usage_surveys (listing_id, years_used, first_owner, use_case, charging_frequency)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, listing_id, years_used, first_owner, use_case, charging_frequency, created_at`, [
        listingId,
        questionnaire.years_used ?? null,
        questionnaire.first_owner ?? null,
        questionnaire.use_case ?? null,
        questionnaire.charging_frequency ?? null,
    ]);
    const row = result.rows[0];
    return {
        id: row.id,
        listing_id: row.listing_id,
        years_used: row.years_used ?? undefined,
        first_owner: row.first_owner ?? undefined,
        use_case: row.use_case ?? undefined,
        charging_frequency: row.charging_frequency ?? undefined,
        created_at: row.created_at,
    };
}
export async function getQuestionnaireByListingId(listingId: string): Promise<UsageSurvey | null> {
    const result = await query<{
        id: string;
        listing_id: string;
        years_used: number | null;
        first_owner: boolean | null;
        use_case: string | null;
        charging_frequency: string | null;
        created_at: Date;
    }>(`SELECT id, listing_id, years_used, first_owner, use_case, charging_frequency, created_at
     FROM public.usage_surveys
     WHERE listing_id = $1
     LIMIT 1`, [listingId]);
    if (result.rows.length === 0)
        return null;
    const row = result.rows[0];
    return {
        id: row.id,
        listing_id: row.listing_id,
        years_used: row.years_used ?? undefined,
        first_owner: row.first_owner ?? undefined,
        use_case: row.use_case ?? undefined,
        charging_frequency: row.charging_frequency ?? undefined,
        created_at: row.created_at,
    };
}
export async function updateQuestionnaire(listingId: string, questionnaire: QuestionnaireData): Promise<UsageSurvey | null> {
    const result = await query<{
        id: string;
        listing_id: string;
        years_used: number | null;
        first_owner: boolean | null;
        use_case: string | null;
        charging_frequency: string | null;
        created_at: Date;
    }>(`UPDATE public.usage_surveys
     SET years_used = COALESCE($2, years_used),
         first_owner = COALESCE($3, first_owner),
         use_case = COALESCE($4, use_case),
         charging_frequency = COALESCE($5, charging_frequency)
     WHERE listing_id = $1
     RETURNING id, listing_id, years_used, first_owner, use_case, charging_frequency, created_at`, [
        listingId,
        questionnaire.years_used ?? null,
        questionnaire.first_owner ?? null,
        questionnaire.use_case ?? null,
        questionnaire.charging_frequency ?? null,
    ]);
    if (result.rows.length === 0)
        return null;
    const row = result.rows[0];
    return {
        id: row.id,
        listing_id: row.listing_id,
        years_used: row.years_used ?? undefined,
        first_owner: row.first_owner ?? undefined,
        use_case: row.use_case ?? undefined,
        charging_frequency: row.charging_frequency ?? undefined,
        created_at: row.created_at,
    };
}
