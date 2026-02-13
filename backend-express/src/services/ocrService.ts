import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { OCRResult } from '../types/api.types';

const KNOWN_BRANDS = ['Tesla', 'Panasonic', 'LG', 'Samsung', 'CATL', 'BYD', 'Sony'];

class OCRService {
  private worker: any = null;

  private async saveTempFile(buffer: Buffer, originalName?: string): Promise<string> {
    const tempDir = os.tmpdir();
    const extension = originalName ? path.extname(originalName) : '.jpg';
    const tempFilePath = path.join(tempDir, `ocr_${Date.now()}_${Math.random().toString(36).substring(7)}${extension}`);
    await fs.writeFile(tempFilePath, buffer);
    return tempFilePath;
  }

  private async preprocessImage(imagePath: string): Promise<string> {
    try {
      const outputDir = path.dirname(imagePath);
      const processedPath = path.join(outputDir, `processed_${Date.now()}.png`);

      const image = sharp(imagePath);
      const metadata = await image.metadata();

      await image
        .greyscale()
        .normalize()
        .sharpen({ sigma: 1.5, m1: 1.2, m2: 0.8, x1: 2, y2: 10, y3: 20 })
        .resize(
          metadata.width && metadata.width > 2000 ? 2000 : undefined,
          metadata.height && metadata.height > 2000 ? 2000 : undefined,
          { fit: 'inside', withoutEnlargement: true }
        )
        .toFile(processedPath);

      return processedPath;
    } catch (error) {
      throw new Error(`Image preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseBatteryData(text: string): { battery_code: string; brand?: string; voltage?: number; found: boolean } {
    let battery_code: string | undefined;
    let brand: string | undefined;
    let voltage: number | undefined;
    let found = false;

    const patterns = [
      /BAT[- ]?[A-Z0-9]{6,}/i,
      /[A-Z]{2,}\d{6,}/,
      /Serial[:\s]+([A-Z0-9-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        battery_code = match[1] || match[0];
        found = true;
        break;
      }
    }

    if (!battery_code) {
      battery_code = `BAT-${Date.now()}`;
    }

    const upperText = text.toUpperCase();
    for (const knownBrand of KNOWN_BRANDS) {
      if (upperText.includes(knownBrand.toUpperCase())) {
        brand = knownBrand;
        break;
      }
    }

    const voltageMatch = text.match(/(\d+\.?\d*)\s*V/i);
    if (voltageMatch) {
      voltage = parseFloat(voltageMatch[1]);
    }

    return {
      battery_code,
      brand,
      voltage,
      found,
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

  async extractFromFile(fileBuffer: Buffer, originalName?: string): Promise<OCRResult & { battery_code: string; brand?: string; voltage?: number }> {
    let tempImagePath: string | null = null;
    let processedImagePath: string | null = null;

    try {
      tempImagePath = await this.saveTempFile(fileBuffer, originalName);
      processedImagePath = await this.preprocessImage(tempImagePath);
      await this.initializeWorker();

      const { data: { text } } = await this.worker.recognize(processedImagePath);
      const parsedData = this.parseBatteryData(text);
      const confidenceScore = parsedData.found ? 0.85 : 0.5;

      return {
        extracted_text: text,
        confidence_score: confidenceScore,
        image_url: '',
        battery_code: parsedData.battery_code,
        brand: parsedData.brand,
        voltage: parsedData.voltage,
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

      const { data: { text } } = await this.worker.recognize(processedImagePath);
      const parsedData = this.parseBatteryData(text);
      const confidenceScore = parsedData.found ? 0.85 : 0.5;

      return {
        extracted_text: text,
        confidence_score: confidenceScore,
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
