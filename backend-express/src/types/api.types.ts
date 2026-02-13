export interface QuestionnaireData {
  years_used?: number;
  first_owner?: boolean;
  use_case?: string;
  charging_frequency?: string;
}

export interface OCRResult {
  extracted_text?: string;
  confidence_score?: number;
  image_url: string;
}

export interface ListBatteryRequest {
  battery_code: string;
  brand: string;
  initial_voltage: number;
  years_used: number;
  owner_wallet: string;
  user_voltage?: number;
  description?: string;
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
  requires?: 'voltage' | 'description' | 'questionnaire';
  predicted_voltage?: number;
  user_voltage?: number;
  validation_confidence?: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface FraudCheckResult {
  is_suspicious: boolean;
  confidence: number;
  details?: string;
}

export interface PredictionResult {
  predicted_voltage: number;
  health_score: number;
}

export interface ValidateDescriptionResult {
  is_valid: boolean;
  confidence: number;
  reason?: string;
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
