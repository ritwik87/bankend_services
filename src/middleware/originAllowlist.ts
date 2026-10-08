import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';

/**
 * ALLOWED_ORIGINS: comma separated list of frontend origins allowed to call this API,
 * e.g. "https://tournament.3rdshot.in,https://auction.3rdshot.in,https://match.3rdshot.in".
 * Unset or empty = allow all (previous behaviour), so deploying without it changes nothing.
 */
const normalize = (o: string) => o.trim().replace(/\/+$/, '').toLowerCase();

export const allowedOrigins: string[] = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(normalize)
  .filter(Boolean);

export const isOriginAllowed = (origin?: string): boolean =>
  allowedOrigins.length === 0 || (!!origin && allowedOrigins.includes(normalize(origin)));

// Server-to-server callers (no browser, so no Origin header) that must keep working
const EXEMPT_PATHS = ['/api/payment/webhook'];

/** Rejects browser requests whose Origin is not in ALLOWED_ORIGINS. */
export const enforceOrigin = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.get('origin');

  if (allowedOrigins.length === 0 || !origin || EXEMPT_PATHS.some((p) => req.path.startsWith(p))) {
    next();
    return;
  }

  if (!isOriginAllowed(origin)) {
    logger.warn(`Blocked origin ${origin} on ${req.method} ${req.path} (ip=${req.ip})`);
    res.status(403).json({ success: false, error: 'Origin not allowed', message: 'Origin not allowed' });
    return;
  }

  next();
};

if (allowedOrigins.length === 0) {
  logger.warn('ALLOWED_ORIGINS is not set: the API accepts requests from any origin.');
}
