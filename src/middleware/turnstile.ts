import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile token before an OTP is created or sent.
 * The token comes from the X-Turnstile-Token header. Enabled by setting TURNSTILE_SECRET_KEY;
 * when it is unset the check is skipped so deploying the code first changes nothing.
 * Fails closed: if Cloudflare cannot be reached, the request is rejected.
 */
export const verifyTurnstile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    next();
    return;
  }

  const token = req.get('x-turnstile-token') || req.body?.turnstileToken;
  const reject = (status: number, message: string) => {
    res.status(status).json({ success: false, message, error: message, userExists: false });
  };

  if (!token || typeof token !== 'string' || token.length > 2048) {
    logger.warn(`Turnstile: missing token (ip=${req.ip})`);
    reject(400, 'Security check missing. Please refresh the page and try again.');
    return;
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (req.ip) body.set('remoteip', req.ip);

    const cf = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const result = (await cf.json()) as { success: boolean; 'error-codes'?: string[]; hostname?: string };

    if (!result.success) {
      logger.warn(`Turnstile: rejected token (ip=${req.ip}) ${(result['error-codes'] || []).join(',')}`);
      reject(400, 'Security check failed. Please refresh the page and try again.');
      return;
    }

    next();
  } catch (error) {
    logger.error('Turnstile: verification request failed:', error);
    reject(503, 'Could not verify the security check. Please try again.');
  }
};
