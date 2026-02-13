import { Router } from 'express';
import { createWallet } from '../controllers/walletController';

const router = Router();

router.post('/create', createWallet);

export default router;
