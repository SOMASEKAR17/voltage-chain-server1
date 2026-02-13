import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ocrService } from '../services/ocrService';
import { OCRResponse } from '../types/api.types';

export const scanLabel: RequestHandler = async (req, res, next) => {
  try {
    const file = req.file || (req.files && Array.isArray(req.files) ? req.files[0] : null);
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided. Please upload an image file.',
        data: null,
      });
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
        data: null,
      });
    }

    const buffer = (file as Express.Multer.File & { buffer?: Buffer }).buffer;
    if (!buffer) {
      return res.status(400).json({
        success: false,
        message: 'File data not available. Use memory storage for uploads.',
        data: null,
      });
    }

    const ocrResult = await ocrService.extractFromFile(buffer, file.originalname);

    res.json({
      success: true,
      message: 'OCR extraction completed successfully',
      data: ocrResult,
    } as OCRResponse);
  } catch (error) {
    next(error);
  }
};
