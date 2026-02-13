import { Battery } from '../types/battery.types';
export function validateBatteryPayload(obj: any): obj is Battery {
    return (obj &&
        typeof obj.battery_code === 'string' &&
        typeof obj.brand === 'string' &&
        (obj.initial_capacity === undefined || typeof obj.initial_capacity === 'number') &&
        (obj.current_capacity === undefined || typeof obj.current_capacity === 'number') &&
        (obj.manufacture_year === undefined || typeof obj.manufacture_year === 'number') &&
        (obj.charging_cycles === undefined || typeof obj.charging_cycles === 'number'));
}
