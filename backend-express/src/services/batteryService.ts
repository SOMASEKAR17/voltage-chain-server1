import { query } from '../config/postgres';
import { Battery } from '../types/battery.types';
import { PredictionResult } from '../types/api.types';

export interface BatteryHistoryRecord {
  id: string;
  battery_id: string;
  nft_token_id?: string;
}

export interface CreateBatteryForListingParams {
  battery_code: string;
  brand: string;
  initial_voltage: number;
  years_used: number;
  current_voltage: number;
  health_score: number;
  prediction_data: PredictionResult;
  is_listed: boolean;
  owner_wallet: string;
}

export interface CreatedBattery {
  id: string;
  battery_code: string;
  brand: string;
  initial_voltage: number;
  nft_token_id?: string;
}

export async function getBatteryStatus(id: string): Promise<Battery | null> {
  return { id, level: 100, status: 'ok' };
}

export async function getBatteryHistory(battery_code: string, brand: string): Promise<BatteryHistoryRecord | null> {
  const result = await query<{ id: string; nft_token_id: string | null }>(
    `SELECT id, nft_token_id FROM public.batteries WHERE battery_code = $1 AND brand = $2 LIMIT 1`,
    [battery_code, brand]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    battery_id: row.id,
    nft_token_id: row.nft_token_id ?? undefined,
  };
}

export async function createBattery(payload: Partial<Battery>): Promise<Battery> {
  return { id: payload.id || 'generated-id', level: payload.level || 0, status: payload.status } as Battery;
}

export async function createBatteryForListing(params: CreateBatteryForListingParams): Promise<CreatedBattery> {
  const result = await query<{ id: string }>(
    `INSERT INTO public.batteries (battery_code, brand, initial_voltage, manufacture_year, nft_token_id, minted)
     VALUES ($1, $2, $3, $4, NULL, false)
     RETURNING id`,
    [params.battery_code, params.brand, params.initial_voltage, new Date().getFullYear() - params.years_used]
  );
  const id = result.rows[0].id;
  return {
    id,
    battery_code: params.battery_code,
    brand: params.brand,
    initial_voltage: params.initial_voltage,
  };
}

export async function updateBatteryNFT(batteryId: string, tokenId: string, txHash: string): Promise<void> {
  await query(
    `UPDATE public.batteries SET nft_token_id = $1, minted = true WHERE id = $2`,
    [tokenId, batteryId]
  );
}

export async function recordHistoryEvent(params: {
  battery_code: string;
  brand: string;
  event_type: string;
  voltage: number;
  health_score: number;
  owner_wallet: string;
  nft_token_id?: string;
}): Promise<void> {
  const batteryResult = await query<{ id: string }>(
    `SELECT id FROM public.batteries WHERE battery_code = $1 AND brand = $2 LIMIT 1`,
    [params.battery_code, params.brand]
  );
  if (batteryResult.rows.length === 0) return;
  const battery_id = batteryResult.rows[0].id;
  await query(
    `INSERT INTO public.battery_history (battery_id, event_type, voltage, soh_percent, notes)
     VALUES ($1, $2, $3, $4, $5)`,
    [battery_id, params.event_type, params.voltage, params.health_score, params.nft_token_id ?? null]
  );
}
