import express from 'express';
import Joi from 'joi';
import { createRateLimiter } from '../middleware/rateLimiter';
import { createHumanChallenge, verifyHumanChallenge } from '../services/humanCheck.service';
import { leagueGuestService } from '../services/leagueGuest.service';
import logger from '../utils/logger';

/**
 * Public routes (no Supabase login) for registering in an individual league with a phone number
 * and a human check. Mounted at /api/leagues/guest, BEFORE the authenticated league router.
 * See leagueGuest.service.ts for why this never creates a login session.
 */
const router = express.Router();

const identifyLimiter = createRateLimiter(15 * 60 * 1000, 20);
const challengeLimiter = createRateLimiter(15 * 60 * 1000, 60);
const actionLimiter = createRateLimiter(15 * 60 * 1000, 40);

const humanCheckSchema = Joi.object({
  token: Joi.string().max(200).required(),
  answer: Joi.string().max(10).required(),
});

const identifySchema = Joi.object({
  phone: Joi.string().trim().pattern(/^[0-9]{10}$/).required(),
  name: Joi.string().trim().min(2).max(100).optional().allow(''),
  humanCheck: humanCheckSchema.required(),
});

const fieldValuesSchema = Joi.object().pattern(Joi.string().uuid(), Joi.string().allow('').max(2000));

const orderSchema = Joi.object({
  guestToken: Joi.string().max(500).required(),
  fieldValues: fieldValuesSchema.optional(),
  termsAccepted: Joi.boolean().optional(),
});

const freeSchema = orderSchema.keys({
  fieldMetadata: Joi.object().optional(),
});

const handle =
  (fn: (req: express.Request) => Promise<{ status: number; body: any }>) =>
  async (req: express.Request, res: express.Response) => {
    try {
      const { status, body } = await fn(req);
      res.status(status).json(body);
    } catch (error) {
      logger.error('League guest route failed:', error);
      res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
    }
  };

const fail = (status: number, error: string) => ({ status, body: { success: false, error } });

/** GET /api/leagues/guest/human-check */
router.get('/human-check', challengeLimiter, (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ success: true, ...createHumanChallenge() });
});

/** POST /api/leagues/guest/:leagueId/identify — phone + human check → profile prefill + guest token */
router.post(
  '/:leagueId/identify',
  identifyLimiter,
  handle(async (req) => {
    const { error, value } = identifySchema.validate(req.body);
    if (error) return fail(400, error.details[0].message);
    if (!verifyHumanChallenge(value.humanCheck)) {
      return fail(400, 'Human check failed or expired. Please try again.');
    }
    const result = await leagueGuestService.identify(
      req.params.leagueId,
      value.phone,
      value.name || undefined
    );
    if (!result.ok) return fail(result.status, result.error);
    return { status: 200, body: { success: true, ...result } };
  })
);

/** POST /api/leagues/guest/:leagueId/create-order — paid leagues */
router.post(
  '/:leagueId/create-order',
  actionLimiter,
  handle(async (req) => {
    const { error, value } = orderSchema.validate(req.body);
    if (error) return fail(400, error.details[0].message);
    const result = await leagueGuestService.createOrder(
      req.params.leagueId,
      value.guestToken,
      value.fieldValues,
      !!value.termsAccepted,
      req.headers['user-agent']
    );
    if (!result.ok) return fail(result.status, result.error);
    return { status: 201, body: { success: true, order: result.order } };
  })
);

/** POST /api/leagues/guest/:leagueId/register-free — free leagues */
router.post(
  '/:leagueId/register-free',
  actionLimiter,
  handle(async (req) => {
    const { error, value } = freeSchema.validate(req.body);
    if (error) return fail(400, error.details[0].message);
    const result = await leagueGuestService.registerFree(
      req.params.leagueId,
      value.guestToken,
      value.fieldValues,
      value.fieldMetadata,
      !!value.termsAccepted,
      req.headers['user-agent']
    );
    if (!result.ok) return fail(result.status, result.error);
    return { status: 201, body: { success: true, registrationId: result.registrationId } };
  })
);

/** POST /api/leagues/guest/:leagueId/payment-status — polled until the webhook has registered the player */
router.post(
  '/:leagueId/payment-status',
  handle(async (req) => {
    const { error, value } = Joi.object({
      guestToken: Joi.string().max(500).required(),
      paymentId: Joi.string().max(100).required(),
    }).validate(req.body);
    if (error) return fail(400, error.details[0].message);
    const result = await leagueGuestService.paymentStatus(
      req.params.leagueId,
      value.guestToken,
      value.paymentId
    );
    if (!result.ok) return fail(result.status, result.error);
    return { status: 200, body: { success: true, registered: result.registered } };
  })
);

export default router;
