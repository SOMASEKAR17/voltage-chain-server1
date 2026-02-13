import { GoogleGenAI, createPartFromBase64, createUserContent } from '@google/genai';
import { uploadImageBuffer, isCloudinaryConfigured } from '../config/cloudinary';
import { query } from '../config/postgres';
import logger from '../utils/logger';

function getGeminiApiKey(): string {
    const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!key) throw new Error('Gemini API key not configured');
    return key;
}

export interface ExtractedBatteryFields {
    is_valid_battery_label: boolean;
    battery_code?: string;
    brand?: string;
    voltage?: number;
    capacity?: number;
    manufacture_year?: number;
    charging_cycles?: number;
    extracted_text?: string;
    confidence_score?: number;
}

export interface OCRScanResult {
    extracted_text: string;
    confidence_score: number;
    image_url: string;
    battery_code: string;
    brand?: string;
    voltage?: number;
    capacity?: number;
    manufacture_year?: number;
    charging_cycles?: number;
    ocr_record_id?: string;
}

const VALIDATION_PROMPT = `You are an expert at identifying automotive vehicle battery labels.

TASK 1 - VALIDATION:
First, determine if this image shows a label from an AUTOMOTIVE VEHICLE BATTERY (EV/hybrid car battery, 12V starter battery, or similar automotive battery).
- Valid: EV battery packs, hybrid battery labels, 12V car battery labels, automotive BMS labels.
- Invalid: Phone/laptop batteries, power banks, consumer electronics batteries, random non-battery images, documents, people, scenery.

If the image is NOT a valid automotive vehicle battery label, respond with ONLY this exact JSON (no other text):
{"is_valid_battery_label": false, "confidence_score": 0}

If the image IS a valid automotive vehicle battery label, proceed to TASK 2.

TASK 2 - EXTRACTION:
Extract the following fields from the visible text on the label. Use null for any field not found.
- battery_code: Serial number, P/N, model number, or unique identifier (string)
- brand: Manufacturer name (e.g., Tesla, Panasonic, LG, Samsung, CATL, BYD, Exide, Amaron)
- voltage: Nominal voltage in Volts (number, e.g., 12, 48, 400)
- capacity: Capacity in Ah or mAh (number; if mAh, convert to Ah)
- manufacture_year: Year of manufacture if visible (number)
- charging_cycles: Cycle count if visible (number)
- extracted_text: Concise summary of key visible text (string)
- confidence_score: Your confidence in the extraction, 0.0 to 1.0 (number)

Respond with ONLY valid JSON in this exact structure (no markdown, no code block):
{"is_valid_battery_label": true, "battery_code": "...", "brand": "...", "voltage": null, "capacity": null, "manufacture_year": null, "charging_cycles": null, "extracted_text": "...", "confidence_score": 0.9}`;

function getMimeType(buffer: Buffer, originalName?: string): string {
    const header = buffer.subarray(0, 12);
    if (header[0] === 0xff && header[1] === 0xd8) return 'image/jpeg';
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e) return 'image/png';
    if (header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42) return 'image/webp';
    if (originalName) {
        const ext = originalName.toLowerCase().slice(originalName.lastIndexOf('.'));
        if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg';
        if (ext === '.png') return 'image/png';
        if (ext === '.webp') return 'image/webp';
    }
    return 'image/jpeg';
}

function parseGeminiResponse(text: string): ExtractedBatteryFields {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned) as ExtractedBatteryFields;
    if (typeof parsed.is_valid_battery_label !== 'boolean') throw new Error('Invalid Gemini response');
    return parsed;
}

class OCRService {
    async extractFromFile(
        fileBuffer: Buffer,
        originalName?: string,
        options?: { user_id?: string; battery_id?: string }
    ): Promise<OCRScanResult> {
        const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
        const mimeType = getMimeType(fileBuffer, originalName);
        const base64 = fileBuffer.toString('base64');

        const contents = createUserContent([
            createPartFromBase64(base64, mimeType),
            VALIDATION_PROMPT,
        ]);

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents,
        });

        const responseText = response.text?.trim() ?? '';
        if (!responseText) throw new Error('Gemini returned empty response');

        let extracted: ExtractedBatteryFields;
        try {
            extracted = parseGeminiResponse(responseText);
        } catch (e) {
            logger.error(`[OCR] Parse failed: ${responseText.slice(0, 300)}`);
            throw new Error('OCR extraction failed: could not parse model response');
        }

        if (!extracted.is_valid_battery_label) {
            throw new Error('Image is not a valid automotive vehicle battery label. Please upload an image of a battery label.');
        }

        const batteryCode = extracted.battery_code?.trim() || `BAT-SCANNED-${Date.now()}`;
        const confidence = typeof extracted.confidence_score === 'number'
            ? Math.min(1, Math.max(0, extracted.confidence_score))
            : 0.7;

        if (!isCloudinaryConfigured()) throw new Error('Cloudinary not configured');

        const imageUrl = await uploadImageBuffer(fileBuffer, { folder: 'ocr_labels', mimeType });
        logger.info(`[OCR] Uploaded: ${imageUrl}`);

        let ocrRecordId: string | undefined;
        try {
            const r = await query<{ id: string }>(
                `INSERT INTO public.ocr_records (user_id, battery_id, image_url, extracted_text, confidence_score)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [options?.user_id ?? null, options?.battery_id ?? null, imageUrl, extracted.extracted_text ?? null, confidence]
            );
            ocrRecordId = r.rows[0]?.id;
        } catch (dbErr) {
            logger.error(`[OCR] DB insert failed: ${dbErr}`);
        }

        return {
            extracted_text: extracted.extracted_text ?? '',
            confidence_score: confidence,
            image_url: imageUrl,
            battery_code: batteryCode,
            brand: extracted.brand ?? undefined,
            voltage: extracted.voltage ?? undefined,
            capacity: extracted.capacity ?? undefined,
            manufacture_year: extracted.manufacture_year ?? undefined,
            charging_cycles: extracted.charging_cycles ?? undefined,
            ocr_record_id: ocrRecordId,
        };
    }
}

export const ocrService = new OCRService();
export default ocrService;
