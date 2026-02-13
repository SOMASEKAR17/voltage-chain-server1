import {
  FraudCheckResult,
  PredictionResult,
  ValidateDescriptionResult,
  QuestionnaireData,
} from '../types/api.types';

export async function forwardToFastApi(path: string, body: any): Promise<any> {
  const base = process.env.FASTAPI_URL || '';
  if (!base) throw new Error('FASTAPI_URL not configured');

  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) throw new Error(`FastAPI error: ${res.status} ${res.statusText}`);

  return res.json();
}

export async function checkFraud(params: {
  battery_code: string;
  brand: string;
  initial_voltage: number;
  years_used: number;
}): Promise<FraudCheckResult> {
  return forwardToFastApi('/check-fraud', params);
}

export async function predictVoltage(params: {
  battery_code: string;
  brand: string;
  initial_voltage: number;
  years_used: number;
}): Promise<PredictionResult> {
  return forwardToFastApi('/predict-voltage', params);
}

export async function predictFromQuestionnaire(params: {
  battery_code: string;
  brand: string;
  initial_voltage: number;
  years_used: number;
  questionnaire: QuestionnaireData;
}): Promise<PredictionResult> {
  return forwardToFastApi('/predict-questionnaire', params);
}

export async function validateDescription(params: {
  battery_code: string;
  brand: string;
  initial_voltage: number;
  years_used: number;
  predicted_voltage: number;
  user_voltage: number;
  description: string;
}): Promise<ValidateDescriptionResult> {
  return forwardToFastApi('/validate-description', params);
}
