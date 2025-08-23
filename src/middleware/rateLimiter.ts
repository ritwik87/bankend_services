import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../types/dupr.types';

export const createRateLimiter = (windowMs: number = 15 * 60 * 1000, max: number = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    } as ApiResponse<null>,
    standardHeaders: true,
    legacyHeaders: false,
  });
};

export const duprApiLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
);

export const strictLimiter = createRateLimiter(60 * 1000, 10); // 10 requests per minute