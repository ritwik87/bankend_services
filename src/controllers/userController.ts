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
   * Deactivate user (change role to guest)
   */
  async deactivateUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
        return;
      }

      logger.info('Deactivating user:', { userId });

      const result = await userService.deactivateUser(userId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in deactivateUser controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Permanently delete user
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
        return;
      }

      logger.info('Deleting user:', { userId });

      const result = await userService.deleteUser(userId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in deleteUser controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update user profile
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId, userData } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
        return;
      }

      if (!userData || typeof userData !== 'object') {
        res.status(400).json({
          success: false,
          message: 'User data is required',
        });
        return;
      }

      logger.info('Updating user:', { userId, fields: Object.keys(userData) });

      const result = await userService.updateUser(userId, userData);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in updateUser controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Admin register user - Create/update user without OTP
   */
  async adminRegisterUser(req: Request, res: Response): Promise<void> {
    try {
      // Validation schema
      const schema = Joi.object({
        phone: Joi.string()
          .pattern(/^\+[1-9]\d{1,3}[0-9]{6,14}$/)
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
          role: Joi.string()
            .valid('player', 'organizer', 'admin', 'umpire')
            .required()
            .messages({
              'any.only':
                'Role must be player, organizer, admin, or umpire',
              'any.required': 'Role is required',
            }),
          organizationName: Joi.string().min(2).allow('', null).optional().messages({
            'string.min': 'Organization name must be at least 2 characters',
          }),
          organizationDescription: Joi.string().min(10).allow('', null).optional().messages({
            'string.min':
              'Organization description must be at least 10 characters',
          }),
          experience: Joi.string().min(5).allow('', null).optional().messages({
            'string.min': 'Experience must be at least 5 characters',
          }),
        })
          .required()
          .messages({
            'any.required': 'User data is required',
          }),
      });

      const { error, value } = schema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: error.details[0].message,
        });
        return;
      }

      const { phone, userData } = value;

      // Log the admin registration attempt
      logger.info('Admin registering user for phone:', {
        phone: phone.replace(/(.{3})(.*)(.{2})/, '$1***$3'),
        role: userData.role,
        name: userData.name,
      });

      const result = await userService.adminRegisterUser({ phone, userData });

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in adminRegisterUser controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
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