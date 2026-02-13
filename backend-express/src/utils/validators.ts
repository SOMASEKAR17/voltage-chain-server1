import { Battery } from '../types/battery.types';

export function validateBatteryPayload(obj: any): obj is Battery {
  return obj && typeof obj.id === 'string' && typeof obj.level === 'number';
}
