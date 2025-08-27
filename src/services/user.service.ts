import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger';
import {
  UpdateEmailRequest,
  UpdateEmailResponse,
  ValidateEmailRequest,
  ValidateEmailResponse,
} from '../types/user.types';

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export class UserService {
  /**
   * Validate if email is available (not already in use)
   */
  async validateEmailAvailability(
    request: ValidateEmailRequest
  ): Promise<ValidateEmailResponse> {
    try {
      const { email, excludeUserId } = request;

      // Check in auth.users table
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        logger.error('Error checking email in auth.users:', authError);
        return {
          success: false,
          available: false,
          error: 'Failed to validate email availability',
        };
      }

      // Check if email already exists (excluding the current user if provided)
      const emailExists = authUsers.users.some(
        user => user.email === email && user.id !== excludeUserId
      );

      if (emailExists) {
        return {
          success: true,
          available: false,
        };
      }

      // Also check in profiles table as a backup
      let query = supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email);

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      const { data: profiles, error: profileError } = await query;

      if (profileError) {
        logger.error('Error checking email in profiles:', profileError);
        return {
          success: false,
          available: false,
          error: 'Failed to validate email availability',
        };
      }

      const profileEmailExists = profiles && profiles.length > 0;

      return {
        success: true,
        available: !emailExists && !profileEmailExists,
      };
    } catch (error) {
      logger.error('Error validating email availability:', error);
      return {
        success: false,
        available: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Update user email in both auth.users and profiles tables
   */
  async updateUserEmail(
    request: UpdateEmailRequest
  ): Promise<UpdateEmailResponse> {
    try {
      const { userId, newEmail, currentEmail } = request;

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return {
          success: false,
          message: 'Invalid email format',
        };
      }

      // Check if new email is different from current email
      if (newEmail === currentEmail) {
        return {
          success: false,
          message: 'New email must be different from current email',
        };
      }

      // Validate email availability
      const availabilityCheck = await this.validateEmailAvailability({
        email: newEmail,
        excludeUserId: userId,
      });

      if (!availabilityCheck.success || !availabilityCheck.available) {
        return {
          success: false,
          message: 'Email is already in use by another account',
        };
      }

      // Update email in auth.users table
      const { error: authError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          email: newEmail,
          email_confirm: true, // Skip email confirmation for admin updates
        }
      );

      if (authError) {
        logger.error('Error updating email in auth.users:', authError);
        return {
          success: false,
          message: 'Failed to update email in authentication system',
          error: authError.message,
        };
      }

      // Update email in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ email: newEmail })
        .eq('id', userId);

      if (profileError) {
        logger.error('Error updating email in profiles:', profileError);
        
        // Try to rollback auth email change
        try {
          await supabase.auth.admin.updateUserById(userId, {
            email: currentEmail,
          });
        } catch (rollbackError) {
          logger.error('Failed to rollback auth email change:', rollbackError);
        }

        return {
          success: false,
          message: 'Failed to update email in user profile',
          error: profileError.message,
        };
      }

      logger.info(`Email updated successfully for user ${userId}: ${currentEmail} -> ${newEmail}`);

      return {
        success: true,
        message: 'Email updated successfully',
      };
    } catch (error) {
      logger.error('Error updating user email:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const userService = new UserService();