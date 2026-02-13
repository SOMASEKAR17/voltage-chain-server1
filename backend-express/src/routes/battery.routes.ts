import { Router, Request, Response } from 'express';

const router = Router();

// Basic health endpoint for battery routes
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Battery routes placeholder' });
});

export default router;
