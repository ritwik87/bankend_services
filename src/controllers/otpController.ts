import { Request, Response } from 'express';
import Joi from 'joi';
import { otpService } from '../services/otp.service';
import {
  CompleteRegistrationRequest,
  GenerateOtpRequest,
  VerifyOtpRequest,
} from '../types/otp.types';
import logger from '../utils/logger';

// Validation schemas
const generateOtpSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+[1-9]\d{1,3}[0-9]{6,14}$/) // E.164 format
    .required()
    .messages({
      'string.pattern.base':
        'Phone number must be a valid international number (e.g. +919876543210)',
      'any.required': 'Phone number is required',
    }),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+[1-9]\d{1,3}[0-9]{6,14}$/) // E.164 format
    .required()
    .messages({
      'string.pattern.base':
        'Phone number must be a valid international number (e.g. +919876543210)',
      'any.required': 'Phone number is required',
    }),
  otp: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'OTP must be exactly 6 digits',
      'any.required': 'OTP is required',
    }),
  type: Joi.string().optional(),
});

const completeRegistrationSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+[1-9]\d{1,3}[0-9]{6,14}$/) // E.164 format
    .required()
    .messages({
      'string.pattern.base':
        'Phone number must be a valid international number (e.g. +919876543210)',
      'any.required': 'Phone number is required',
    }),
  userData: Joi.object({
    name: Joi.string().min(2).required().messages({
      'string.min': 'Name must be at least 2 characters',
      'any.required': 'Name is required',
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Valid email is required',
      'any.required': 'Email is required',
    }),
    role: Joi.string().valid('player', 'organizer').required().messages({
      'any.only': 'Role must be either player or organizer',
      'any.required': 'Role is required',
    }),
    organizationName: Joi.string().min(2).optional().messages({
      'string.min': 'Organization name must be at least 2 characters',
    }),
    organizationDescription: Joi.string().min(10).optional().messages({
      'string.min': 'Organization description must be at least 10 characters',
    }),
    experience: Joi.string().min(5).optional().messages({
      'string.min': 'Experience must be at least 5 characters',
    }),
  })
    .required()
    .messages({
      'any.required': 'User data is required',
    }),
});

export class OtpController {
  /**
   * Generate and send OTP via WhatsApp
   */
  async generateOtp(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = generateOtpSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      const requestData: GenerateOtpRequest = value;

      // Log the OTP generation attempt (without sensitive data)
      logger.info('Generating OTP for phone:', {
        phone: requestData.phone.replace(/(.{3})(.*)(.{2})/, '$1***$3'),
      });

      const result = await otpService.generateOtp(requestData);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in generateOtp controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Internal server error',
        userExists: false,
      });
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = verifyOtpSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          userExists: false,
          error: error.details[0].message,
        });
        return;
      }

      const requestData: VerifyOtpRequest = value;

      // Log the OTP verification attempt
      logger.info('Verifying OTP for phone:', {
        phone: requestData.phone.replace(/(.{3})(.*)(.{2})/, '$1***$3'),
        otpLength: requestData.otp.length,
      });

      const result = await otpService.verifyOtp(requestData);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in verifyOtp controller:', error);
      res.status(500).json({
        success: false,
        userExists: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Complete user registration after OTP verification
   */
  async completeRegistration(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = completeRegistrationSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: error.details[0].message,
        });
        return;
      }

      const requestData: CompleteRegistrationRequest = value;

      // Log the registration completion attempt
      logger.info('Completing registration for phone:', {
        phone: requestData.phone.replace(/(.{3})(.*)(.{2})/, '$1***$3'),
        role: requestData.userData.role,
        name: requestData.userData.name,
      });

      const result = await otpService.completeRegistration(requestData);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in completeRegistration controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: 'Internal server error',
      });
    }
  }

  /**
   * Validate partner - check if phone belongs to registered player
   */
  async validatePartner(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error } = generateOtpSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          userExists: false,
          isPlayer: false,
          error: error.details[0].message,
        });
        return;
      }

      const { phone } = req.body as { phone: string };
      const result = await otpService.validatePartner({ phone });

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error in validatePartner controller:', error);
      res.status(500).json({
        success: false,
        userExists: false,
        isPlayer: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Verify OTP for partner without affecting main session
   */
  async verifyPartnerOtp(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error } = verifyOtpSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      const { phone, otp } = req.body as VerifyOtpRequest;
      const result = await otpService.verifyPartnerOtp({ phone, otp });

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error in verifyPartnerOtp controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Initialize dummy users in the database
   */
  async initializeDummyUsers(req: Request, res: Response): Promise<void> {
    try {
      const result = await otpService.initializeDummyUsers();

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error in initializeDummyUsers controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initialize dummy users',
        error: 'Internal server error',
      });
    }
  }

  /**
   * Health check for OTP service
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'OTP service is healthy',
      timestamp: new Date().toISOString(),
    });
  }
}

export const otpController = new OtpController();
