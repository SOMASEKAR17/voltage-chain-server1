export interface Battery {
    id: string;
    battery_code: string;
    brand: string;
    initial_capacity?: number;
    current_capacity?: number;
    manufacture_year?: number;
    charging_cycles?: number;
    nft_token_id?: string;
    minted?: boolean;
    created_at?: Date;
}
