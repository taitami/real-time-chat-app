import express from 'express';
import { proxyToGoogleTranslate } from '../controllers/proxyController.js'; 
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/translate/google', protect, proxyToGoogleTranslate);

export default router;