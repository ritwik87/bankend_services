import axios from 'axios';
import logger from '../utils/logger';
import { AIChatRequest, AIChatResponse } from '../types/aiChat.types';

const N8N_WEBHOOK_URL = process.env.N8N_CHAT_WEBHOOK_URL || '';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

export class AIChatService {
  async forwardToN8n(
    payload: AIChatRequest,
    authHeader?: string
  ): Promise<AIChatResponse> {
    if (!N8N_WEBHOOK_URL) {
      throw new Error('AI chat service is not configured.');
    }

    const { data } = await axios.post<AIChatResponse>(N8N_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_API_KEY && { 'x-api-key': N8N_API_KEY }),
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    logger.info('AI chat forwarded to n8n', { entityId: payload.entityId, entityType: payload.entityType });

    return data;
  }
}

export const aiChatService = new AIChatService();
