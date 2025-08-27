import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import {
  UpdateEmailRequest,
  ValidateEmailRequest,
} from '../types/user.types';
import logger from '../utils/logger';
import Joi from 'joi';

// Validation schemas
const updateEmailSchema = Joi.object({
  userId: Joi.string().required(),
  newEmail: Joi.string().email().required(),
  currentEmail: Joi.string().email().required(),
});

const validateEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  excludeUserId: Joi.string().optional(),
});

export class UserController {
  /**
   * Update user email
   */
  async updateEmail(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = updateEmailSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details[0].message
        });
        return;
      }

      const requestData: UpdateEmailRequest = value;

      // Log the update attempt (without sensitive data)
      logger.info('Email update request:', {
        userId: requestData.userId,
        newEmail: requestData.newEmail,
      });

      const result = await userService.updateUserEmail(requestData);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in updateEmail controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Validate email availability
   */
  async validateEmailAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = validateEmailSchema.validate(req.query);
      
      if (error) {
        res.status(400).json({
          success: false,
          available: false,
          error: error.details[0].message
        });
        return;
      }

      const requestData: ValidateEmailRequest = {
        email: value.email,
        excludeUserId: value.excludeUserId,
      };

      logger.info('Email validation request:', {
        email: requestData.email,
        excludeUserId: requestData.excludeUserId,
      });

      const result = await userService.validateEmailAvailability(requestData);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in validateEmailAvailability controller:', error);
      res.status(500).json({
        success: false,
        available: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Health check for user service
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'User service is healthy',
      timestamp: new Date().toISOString()
    });
  }
}

export const userController = new UserController();