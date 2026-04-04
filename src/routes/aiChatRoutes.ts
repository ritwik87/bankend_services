import { Router } from 'express';
import { proxyAIChat } from '../controllers/aiChatController';
import { requireAuth } from '../middleware/auth';
import { aiChatLimiter } from '../middleware/rateLimiter';

const router = Router();

// All AI chat routes require a valid Supabase session
router.use(requireAuth);

router.post('/chat', aiChatLimiter, proxyAIChat);

export default router;
