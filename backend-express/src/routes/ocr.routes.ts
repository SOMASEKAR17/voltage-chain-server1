import { Router, Request, Response } from 'express';

const router = Router();

// Basic health endpoint for OCR routes
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'OCR routes placeholder' });
});

export default router;
