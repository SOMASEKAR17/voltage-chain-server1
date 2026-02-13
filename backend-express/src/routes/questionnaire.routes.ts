import { Router } from 'express';
import { createQuestionnaire, getQuestionnaire } from '../controllers/questionnaireController';
const router = Router();
router.post('/:listing_id', createQuestionnaire);
router.get('/:listing_id', getQuestionnaire);
export default router;
