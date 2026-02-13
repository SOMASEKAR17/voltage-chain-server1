import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { OCRResult } from '../types/api.types';

const KNOWN_BRANDS = ['Tesla', 'Panasonic', 'LG', 'Samsung', 'CATL', 'BYD', 'Sony'];

// Optimized regex patterns with priority ordering
const BATTERY_CODE_PATTERNS = [
    // Specific battery code formats (highest priority)
    { pattern: /\b(?:BAT|BATT|BTY)[- ]?([A-Z0-9]{6,12})\b/i, priority: 1, name: 'BAT_PREFIX' },
    { pattern: /\b(?:SN|S\/N|SERIAL)[:\s#-]*([A-Z0-9]{6,15})\b/i, priority: 2, name: 'SERIAL_NUMBER' },
    { pattern: /\bP\/N[:\s#-]*([A-Z0-9]{6,15})\b/i, priority: 3, name: 'PART_NUMBER' },
    { pattern: /\b(?:MODEL|MDL)[:\s#-]*([A-Z0-9]{6,15})\b/i, priority: 4, name: 'MODEL_NUMBER' },
    
    // Common battery identifier patterns
    { pattern: /\b([A-Z]{2,4}\d{6,10}[A-Z]?)\b/, priority: 5, name: 'ALPHA_NUMERIC' },
    { pattern: /\b(\d{2}[A-Z]{2,3}\d{6,8})\b/, priority: 6, name: 'NUMERIC_ALPHA' },
    { pattern: /\b([A-Z]\d{8,12})\b/, priority: 7, name: 'SINGLE_ALPHA_NUMERIC' },
    
    // Barcode-like patterns
    { pattern: /\b(\d{10,13})\b/, priority: 8, name: 'BARCODE' },
    
    // Fallback pattern for any alphanumeric sequence
    { pattern: /\b([A-Z0-9]{8,15})\b/, priority: 9, name: 'GENERIC' }
];

const VOLTAGE_PATTERNS = [
    // Precise voltage patterns with units
    { pattern: /\b(\d+\.?\d*)\s*V(?:olts?)?\b/i, priority: 1 },
    { pattern: /\b(\d+\.?\d*)\s*VDC\b/i, priority: 2 },
    { pattern: /\bVoltage[:\s]+(\d+\.?\d*)\s*V?\b/i, priority: 3 },
    { pattern: /\b(\d+\.?\d*)\s*Volt\b/i, priority: 4 },
    
    // Common battery voltages (validation range: 1.2V - 800V)
    { pattern: /\b(3\.7|7\.4|11\.1|14\.8|22\.2|48|60|72|400|800)\s*V?\b/, priority: 5 }
];

const CAPACITY_PATTERNS = [
    { pattern: /\b(\d+\.?\d*)\s*(?:mAh|MAH)\b/i, priority: 1 },
    { pattern: /\b(\d+\.?\d*)\s*(?:Ah|AH)\b/i, priority: 2 },
    { pattern: /\bCapacity[:\s]+(\d+\.?\d*)\s*(?:mAh|Ah)?\b/i, priority: 3 }
];

interface ParsedBatteryData {
    battery_code: string;
    brand?: string;
    voltage?: number;
    capacity?: number;
    found: boolean;
    confidence: number;
    matchType?: string;
}

class OCRService {
    private worker: any = null;

    private async saveTempFile(buffer: Buffer, originalName?: string): Promise<string> {
        const tempDir = os.tmpdir();
        const extension = originalName ? path.extname(originalName) : '.jpg';
        const tempFilePath = path.join(
            tempDir,
            `ocr_${Date.now()}_${Math.random().toString(36).substring(7)}${extension}`
        );
        await fs.writeFile(tempFilePath, buffer);
        return tempFilePath;
    }

    private async preprocessImage(imagePath: string): Promise<string> {
        try {
            const outputDir = path.dirname(imagePath);
            const processedPath = path.join(outputDir, `processed_${Date.now()}.png`);
            const image = sharp(imagePath);
            const metadata = await image.metadata();

            // Enhanced preprocessing for better OCR accuracy
            await image
                .greyscale()
                .normalize()
                .sharpen({ sigma: 1.5, m1: 1.2, m2: 0.8, x1: 2, y2: 10, y3: 20 })
                .threshold(128) // Add thresholding for better contrast
                .resize(
                    metadata.width && metadata.width > 2000 ? 2000 : undefined,
                    metadata.height && metadata.height > 2000 ? 2000 : undefined,
                    { fit: 'inside', withoutEnlargement: true }
                )
                .toFile(processedPath);

            return processedPath;
        } catch (error) {
            throw new Error(
                `Image preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Clean and normalize extracted text for better pattern matching
     */
    private cleanText(text: string): string {
        return text
            .replace(/[|]/g, 'I') // Common OCR mistake: | instead of I
            .replace(/[O]/g, '0') // In numeric contexts, O -> 0
            .replace(/[l]/g, '1') // In numeric contexts, l -> 1
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    /**
     * Extract battery code using prioritized patterns
     */
    private extractBatteryCode(text: string): { code: string; confidence: number; matchType: string } | null {
        const cleanedText = this.cleanText(text);
        
        // Try each pattern in priority order
        for (const { pattern, priority, name } of BATTERY_CODE_PATTERNS) {
            const match = cleanedText.match(pattern);
            if (match) {
                const code = match[1] || match[0];
                
                // Validate the extracted code
                if (this.isValidBatteryCode(code)) {
                    // Higher priority = higher confidence
                    const confidence = 1 - (priority * 0.08);
                    return {
                        code: code.trim(),
                        confidence: Math.max(0.5, confidence),
                        matchType: name
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Validate battery code format
     */
    private isValidBatteryCode(code: string): boolean {
        // Must be at least 6 characters
        if (code.length < 6) return false;
        
        // Must contain at least one letter or number
        if (!/[A-Z0-9]/.test(code)) return false;
        
        // Should not be all numbers (likely barcode or other ID)
        if (/^\d+$/.test(code) && code.length < 10) return false;
        
        // Should not contain too many special characters
        if ((code.match(/[^A-Z0-9]/g) || []).length > 3) return false;
        
        return true;
    }

    /**
     * Extract voltage with validation
     */
    private extractVoltage(text: string): number | undefined {
        for (const { pattern } of VOLTAGE_PATTERNS) {
            const match = text.match(pattern);
            if (match) {
                const voltage = parseFloat(match[1]);
                
                // Validate voltage range (1.2V to 800V for various battery types)
                if (voltage >= 1.2 && voltage <= 800) {
                    return voltage;
                }
            }
        }
        return undefined;
    }

    /**
     * Extract capacity with validation
     */
    private extractCapacity(text: string): number | undefined {
        for (const { pattern } of CAPACITY_PATTERNS) {
            const match = text.match(pattern);
            if (match) {
                const capacity = parseFloat(match[1]);
                
                // Validate capacity range
                if (capacity >= 100 && capacity <= 1000000) {
                    return capacity;
                }
            }
        }
        return undefined;
    }

    /**
     * Extract brand with fuzzy matching
     */
    private extractBrand(text: string): string | undefined {
        const upperText = text.toUpperCase();
        
        for (const knownBrand of KNOWN_BRANDS) {
            const brandUpper = knownBrand.toUpperCase();
            
            // Exact match
            if (upperText.includes(brandUpper)) {
                return knownBrand;
            }
            
            // Fuzzy match (allow 1 character difference for OCR errors)
            const words = upperText.split(/\s+/);
            for (const word of words) {
                if (this.levenshteinDistance(word, brandUpper) <= 1 && word.length >= 3) {
                    return knownBrand;
                }
            }
        }
        
        return undefined;
    }

    /**
     * Calculate Levenshtein distance for fuzzy matching
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Parse battery data from extracted text with improved consistency
     */
    private parseBatteryData(text: string): ParsedBatteryData {
        const batteryCodeResult = this.extractBatteryCode(text);
        const brand = this.extractBrand(text);
        const voltage = this.extractVoltage(text);
        const capacity = this.extractCapacity(text);

        let battery_code: string;
        let confidence: number;
        let matchType: string | undefined;
        let found = false;

        if (batteryCodeResult) {
            battery_code = batteryCodeResult.code;
            confidence = batteryCodeResult.confidence;
            matchType = batteryCodeResult.matchType;
            found = true;
        } else {
            // Generate fallback code with timestamp
            battery_code = `BAT-UNKNOWN-${Date.now()}`;
            confidence = 0.3;
        }

        // Boost confidence if we found additional data
        if (brand) confidence += 0.05;
        if (voltage) confidence += 0.05;
        if (capacity) confidence += 0.05;
        
        // Cap confidence at 0.95
        confidence = Math.min(confidence, 0.95);

        return {
            battery_code,
            brand,
            voltage,
            capacity,
            found,
            confidence,
            matchType
        };
    }

    private async initializeWorker(): Promise<void> {
        if (!this.worker) {
            this.worker = await createWorker('eng', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            });
        }
    }

    async extractFromFile(
        fileBuffer: Buffer,
        originalName?: string
    ): Promise<OCRResult & {
        battery_code: string;
        brand?: string;
        voltage?: number;
        capacity?: number;
        matchType?: string;
    }> {
        let tempImagePath: string | null = null;
        let processedImagePath: string | null = null;

        try {
            tempImagePath = await this.saveTempFile(fileBuffer, originalName);
            processedImagePath = await this.preprocessImage(tempImagePath);

            await this.initializeWorker();

            const {
                data: { text },
            } = await this.worker.recognize(processedImagePath);

            const parsedData = this.parseBatteryData(text);

            return {
                extracted_text: text,
                confidence_score: parsedData.confidence,
                image_url: '',
                battery_code: parsedData.battery_code,
                brand: parsedData.brand,
                voltage: parsedData.voltage,
                capacity: parsedData.capacity,
                matchType: parsedData.matchType
            };
        } catch (error) {
            throw new Error(
                `OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        } finally {
            const filesToCleanup = [tempImagePath, processedImagePath].filter(Boolean) as string[];
            for (const filePath of filesToCleanup) {
                try {
                    await fs.unlink(filePath);
                } catch (cleanupError) {
                    console.warn(`Failed to cleanup temporary file ${filePath}: ${cleanupError}`);
                }
            }
        }
    }

    async extractBatteryLabel(imagePath: string): Promise<OCRResult> {
        let processedImagePath: string | null = null;

        try {
            processedImagePath = await this.preprocessImage(imagePath);

            await this.initializeWorker();

            const {
                data: { text },
            } = await this.worker.recognize(processedImagePath);

            const parsedData = this.parseBatteryData(text);

            return {
                extracted_text: text,
                confidence_score: parsedData.confidence,
                image_url: imagePath,
            };
        } catch (error) {
            throw new Error(
                `OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        } finally {
            if (processedImagePath && processedImagePath !== imagePath) {
                try {
                    await fs.unlink(processedImagePath);
                } catch (cleanupError) {
                    console.warn(`Failed to cleanup processed image: ${cleanupError}`);
                }
            }
        }
    }

    async terminate(): Promise<void> {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}

export const ocrService = new OCRService();
export default ocrService;