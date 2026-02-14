/** Matches public.user_surveys schema. */
export interface QuestionnaireData {
    brand_model: string;
    initial_capacity: number;
    current_capacity: number;
    years_owned: number;
    primary_application: 'E-bike' | 'E-car';
    avg_daily_usage: 'Light' | 'Medium' | 'Heavy';
    charging_frequency_per_week: number;
    typical_charge_level: '20-80' | '0-100' | 'Always Full';
    avg_temperature_c?: number;
}

export interface OCRResult {
    extracted_text?: string;
    confidence_score?: number;
    image_url: string;
    battery_code?: string;
    brand?: string;
    voltage?: number;
    capacity?: number;
    manufacture_year?: number;
    charging_cycles?: number;
    ocr_record_id?: string;
}
export interface ListBatteryRequest {
    battery_code: string;
    brand: string;
    initial_capacity: number;
    current_capacity: number;
    manufacture_year: number;
    charging_cycles?: number;
    owner_wallet: string;
    questionnaire?: QuestionnaireData;
}
export interface ListBatteryResponse {
    success: boolean;
    message: string;
    data: {
        battery_id: string;
        battery_code: string;
        health_score: number;
        predicted_voltage: number;
        current_voltage: number;
        nft_token_id?: string;
        is_new_nft: boolean;
        listing_url: string;
    };
}
export interface OCRResponse {
    success: boolean;
    data: OCRResult | null;
    message: string;
}
export interface ErrorResponse {
    error: string;
    required?: string[];
}
export interface ApiResponse<T> {
    data?: T;
    error?: string;
}
export interface ListingImage {
    id: string;
    image_url: string;
    image_type: 'gallery' | 'label';
    position: number;
}
export interface ListingWithImages {
    id: string;
    battery_id: string;
    battery_code?: string;
    brand?: string;
    price: number;
    predicted_voltage?: number;
    user_voltage?: number;
    health_score?: number;
    status: string;
    ai_verified: boolean;
    images: ListingImage[];
}

/** Request body for FastAPI Battery Prediction API POST /api/predict-rul */
export interface PredictRulRequest {
    current_capacity: number;
    initial_capacity: number;
    ambient_temperature?: number;
    cycle_count: number;
    age_days: number;
}

/** Response from FastAPI Battery Prediction API (predict-rul, test-prediction) */
export interface PredictRulResponse {
    success: boolean;
    battery_metrics: {
        initial_capacity_ahr: number;
        current_capacity_ahr: number;
        cycle_count: number;
        age_days: number;
        ambient_temperature_c: number;
    };
    health_analysis: {
        soh_percentage: number;
        health_status: string;
        health_description: string;
        degradation_factor_percent: number;
    };
    rul_prediction: {
        rul_cycles: number;
        estimated_days_to_eol: number;
        estimated_time_to_eol: string;
    };
    recommendations: string[];
}

/** Request for FastAPI POST /api/predict-capacity-survey (survey-based capacity prediction) */
export interface PredictCapacitySurveyRequest {
    listing_id: string;
    brand_model: string;
    initial_capacity: number;
    years_owned: number;
    primary_application: 'E-bike' | 'E-car';
    avg_daily_usage: 'Light' | 'Medium' | 'Heavy';
    charging_frequency_in_week: number;
    typical_charge_level: '20-80' | '0-100' | 'Always Full';
    avg_temperature?: number;
}

/** Response from FastAPI POST /api/predict-capacity-survey */
export interface CapacityPredictionResponse {
    success: boolean;
    predicted_current_capacity: number;
    confidence: number;
    explanation: string;
    input_summary: {
        brand_model: string;
        initial_capacity_ahr: number;
        years_owned: number;
        primary_application: string;
        avg_daily_usage: string;
        charging_frequency_per_week: number;
        typical_charge_level: string;
        avg_temperature_c: number;
        method?: string;
        soh_percentage?: number;
        total_degradation_percent?: number;
        api_key_used?: string;
    };
}