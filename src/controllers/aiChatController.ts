import { Request, Response } from 'express';
import Joi from 'joi';
import { aiChatService } from '../services/aiChat.service';
import logger from '../utils/logger';

const chatSchema = Joi.object({
  message: Joi.string().min(1).required(),
  sessionId: Joi.string().required(),
  entityId: Joi.string().uuid().required(),
  entityType: Joi.string().valid('tournament', 'league').required(),
  entityName: Joi.string().required(),
  activeFilters: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
});

export const proxyAIChat = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = chatSchema.validate(req.body);
  if (error) {
    res.status(400).json({ success: false, error: error.details[0].message });
    return;
  }

  try {
    const data = await aiChatService.forwardToN8n(value, req.headers.authorization);
    res.json(data);
  } catch (err: any) {
    logger.error('AI chat proxy error', { error: err.message });
    const status = err.message.includes('not configured') ? 503 : 500;
    res.status(status).json({ success: false, error: err.message || 'Failed to reach AI service.' });
  }
};
