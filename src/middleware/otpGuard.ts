import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';
import { supabase } from '../utils/supabase';

const BLOCKED_IPS = (process.env.OTP_BLOCKED_IPS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const REQUIRE_ORIGIN = process.env.OTP_REQUIRE_ORIGIN !== 'false';
const MAX_SENDS_PER_IP_PER_HOUR = parseInt(process.env.OTP_MAX_PER_IP_HOUR || '20', 10);

const deny = (res: Response, status: number, message: string) =>
  res.status(status).json({
    success: false,
    message,
    error: message,
    userExists: false,
    rateLimited: status === 429,
  });

/**
 * Abuse guard for POST /api/otp/generate. Per-phone limits cannot stop one client
 * requesting OTPs for many different numbers, so this works per IP:
 *  1. explicit IP blocklist (OTP_BLOCKED_IPS, comma separated)
 *  2. browsers always send an Origin header on a cross-site POST; a request without one
 *     is a script calling the API directly (disable with OTP_REQUIRE_ORIGIN=false)
 *  3. database-backed cap on OTP sends per IP per hour (survives serverless instances)
 */
export const otpAbuseGuard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const ip = req.ip;

  if (ip && BLOCKED_IPS.includes(ip)) {
    logger.warn(`OTP blocked: blocklisted IP ${ip}`);
    deny(res, 403, 'Request not allowed.');
    return;
  }

  if (REQUIRE_ORIGIN && !req.get('origin')) {
    logger.warn(`OTP blocked: no Origin header (ip=${ip}, ua=${req.get('user-agent') || 'none'})`);
    deny(res, 403, 'Request not allowed.');
    return;
  }

  if (ip) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('otp_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', since);

    if (error) {
      // Do not lock everyone out if the log is unreachable; per-phone limits still apply
      logger.error('OTP per-IP check failed:', error);
    } else if ((count ?? 0) >= MAX_SENDS_PER_IP_PER_HOUR) {
      logger.warn(`OTP blocked: IP ${ip} reached ${MAX_SENDS_PER_IP_PER_HOUR}/hour`);
      deny(res, 429, 'Too many OTP requests from your network. Please try again later.');
      return;
    }
  }

  next();
};
