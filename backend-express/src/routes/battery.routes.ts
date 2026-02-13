import { Router } from 'express';
import { getBattery, createBattery, listBattery } from '../controllers/batteryController';

const router = Router();

router.get('/:id', getBattery);
router.post('/', createBattery);
router.post('/list', listBattery);

export default router;
