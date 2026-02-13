import { RequestHandler } from 'express';
import { ocrService } from '../services/ocrService';
import { OCRResponse } from '../types/api.types';

export const scanLabel: RequestHandler = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided. Please upload an image file.',
                data: null,
            } as OCRResponse);
        }
        const buffer = (file as Express.Multer.File & { buffer?: Buffer }).buffer;
        if (!buffer) {
            return res.status(400).json({
                success: false,
                message: 'File data not available. Use memory storage for uploads.',
                data: null,
            } as OCRResponse);
        }

        const user_id = (req.body?.user_id as string) || undefined;
        const battery_id = (req.body?.battery_id as string) || undefined;

        const ocrResult = await ocrService.extractFromFile(buffer, file.originalname, {
            user_id,
            battery_id,
        });

        return res.json({
            success: true,
            message: 'OCR extraction completed successfully',
            data: ocrResult,
        } as OCRResponse);
    } catch (error) {
        const err = error as Error;
        if (String((error as Error)?.message || '').includes('not a valid automotive vehicle battery label')) {
            return res.status(400).json({
                success: false,
                message: err.message,
                data: null,
            } as OCRResponse);
        }
        next(error);
    }
};
