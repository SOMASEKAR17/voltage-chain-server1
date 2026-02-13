import { Router } from 'express';
import {
  mintBatteryNFT,
  updateBatteryMetadata,
  transferBatteryNFT,
  burnBatteryNFT,
  getBatteryOnChain,
} from '../controllers/nftController';

const router = Router();

router.post('/mint', mintBatteryNFT);
router.post('/update-metadata', updateBatteryMetadata);
router.post('/transfer', transferBatteryNFT);
router.post('/burn', burnBatteryNFT);
router.get('/:tokenId', getBatteryOnChain);

export default router;
