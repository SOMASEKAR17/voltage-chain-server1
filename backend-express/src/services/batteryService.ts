import { query } from '../config/postgres';
import { Battery } from '../types/battery.types';
export interface BatteryHistoryRecord {
    id: string;
    battery_id: string;
    nft_token_id?: string;
}
export interface CreateBatteryForListingParams {
    battery_code: string;
    brand: string;
    initial_capacity: number;
    current_capacity: number;
    manufacture_year: number;
    charging_cycles?: number;
    owner_wallet: string;
}
export interface CreatedBattery {
    id: string;
    battery_code: string;
    brand: string;
    initial_capacity: number;
    current_capacity: number;
    manufacture_year: number;
    charging_cycles?: number;
    nft_token_id?: string;
}
export async function getBatteryStatus(id: string): Promise<Battery | null> {
    const result = await query<{
        id: string;
        battery_code: string;
        brand: string;
        initial_capacity: number | null;
        current_capacity: number | null;
        manufacture_year: number | null;
        charging_cycles: number | null;
        nft_token_id: string | null;
        minted: boolean | null;
        created_at: Date;
    }>(`SELECT id, battery_code, brand, initial_capacity, current_capacity, 
            manufacture_year, charging_cycles, nft_token_id, minted, created_at
     FROM public.batteries WHERE id = $1`, [id]);
    if (result.rows.length === 0)
        return null;
    const row = result.rows[0];
    return {
        id: row.id,
        battery_code: row.battery_code,
        brand: row.brand,
        initial_capacity: row.initial_capacity ?? undefined,
        current_capacity: row.current_capacity ?? undefined,
        manufacture_year: row.manufacture_year ?? undefined,
        charging_cycles: row.charging_cycles ?? undefined,
        nft_token_id: row.nft_token_id ?? undefined,
        minted: row.minted ?? false,
        created_at: row.created_at,
    };
}
export async function getBatteryHistory(battery_code: string, brand: string): Promise<BatteryHistoryRecord | null> {
    const result = await query<{
        id: string;
        nft_token_id: string | null;
    }>(`SELECT id, nft_token_id FROM public.batteries WHERE battery_code = $1 AND brand = $2 LIMIT 1`, [battery_code, brand]);
    if (result.rows.length === 0)
        return null;
    const row = result.rows[0];
    return {
        id: row.id,
        battery_id: row.id,
        nft_token_id: row.nft_token_id ?? undefined,
    };
}
export async function createBattery(payload: Partial<Battery>): Promise<Battery> {
    if (!payload.battery_code || !payload.brand) {
        throw new Error('battery_code and brand are required');
    }
    const result = await query<{
        id: string;
    }>(`INSERT INTO public.batteries (battery_code, brand, initial_capacity, current_capacity, 
                                   manufacture_year, charging_cycles, nft_token_id, minted)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`, [
        payload.battery_code,
        payload.brand,
        payload.initial_capacity ?? null,
        payload.current_capacity ?? null,
        payload.manufacture_year ?? null,
        payload.charging_cycles ?? null,
        payload.nft_token_id ?? null,
        payload.minted ?? false,
    ]);
    const id = result.rows[0].id;
    return {
        id,
        battery_code: payload.battery_code,
        brand: payload.brand,
        initial_capacity: payload.initial_capacity,
        current_capacity: payload.current_capacity,
        manufacture_year: payload.manufacture_year,
        charging_cycles: payload.charging_cycles,
        nft_token_id: payload.nft_token_id,
        minted: payload.minted ?? false,
    };
}
export async function createBatteryForListing(params: CreateBatteryForListingParams): Promise<CreatedBattery> {
    const result = await query<{
        id: string;
    }>(`INSERT INTO public.batteries (battery_code, brand, initial_capacity, current_capacity, 
                                   manufacture_year, charging_cycles, nft_token_id, minted)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, false)
     RETURNING id`, [
        params.battery_code,
        params.brand,
        params.initial_capacity,
        params.current_capacity,
        params.manufacture_year,
        params.charging_cycles ?? null,
    ]);
    const id = result.rows[0].id;
    return {
        id,
        battery_code: params.battery_code,
        brand: params.brand,
        initial_capacity: params.initial_capacity,
        current_capacity: params.current_capacity,
        manufacture_year: params.manufacture_year,
        charging_cycles: params.charging_cycles,
    };
}
export async function updateBatteryNFT(batteryId: string, tokenId: string, txHash: string): Promise<void> {
    await query(`UPDATE public.batteries SET nft_token_id = $1, minted = true WHERE id = $2`, [tokenId, batteryId]);
}
export async function recordHistoryEvent(params: {
    battery_code: string;
    brand: string;
    event_type: string;
    voltage?: number;
    health_score?: number;
    owner_wallet: string;
    nft_token_id?: string;
}): Promise<void> {
    const batteryResult = await query<{
        id: string;
    }>(`SELECT id FROM public.batteries WHERE battery_code = $1 AND brand = $2 LIMIT 1`, [params.battery_code, params.brand]);
    if (batteryResult.rows.length === 0)
        return;
    const battery_id = batteryResult.rows[0].id;
    await query(`INSERT INTO public.battery_history (battery_id, event_type, voltage, soh_percent, notes)
     VALUES ($1, $2, $3, $4, $5)`, [
        battery_id,
        params.event_type,
        params.voltage ?? null,
        params.health_score ?? null,
        params.nft_token_id ?? null,
    ]);
}
