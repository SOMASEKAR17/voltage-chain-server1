import { Router } from 'express';
import { scanLabel } from '../controllers/ocrController';
import { uploadMiddleware, handleUploadError } from '../middleware/upload.middleware';

const router = Router();

router.post('/scan-label', uploadMiddleware, handleUploadError, scanLabel);

export default router;
