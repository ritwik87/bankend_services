import { createClient } from '@supabase/supabase-js';
import {
  UpdateEmailRequest,
  UpdateEmailResponse,
  ValidateEmailRequest,
  ValidateEmailResponse,
} from '../types/user.types';
import { phoneOrCondition } from '../utils/helper';
import logger from '../utils/logger';

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
      const { data: authUsers, error: authError } =
        await supabase.auth.admin.listUsers();

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
        (user) => user.email === email && user.id !== excludeUserId
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

      logger.info(
        `Email updated successfully for user ${userId}: ${currentEmail} -> ${newEmail}`
      );

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

  /**
   * Deactivate user by changing their role to guest
   */
  async deactivateUser(userId: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      // Update role to guest in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: 'guest',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) {
        logger.error('Error deactivating user in profiles:', profileError);
        return {
          success: false,
          message: 'Failed to deactivate user',
          error: profileError.message,
        };
      }

      logger.info(`User deactivated successfully: ${userId}`);

      return {
        success: true,
        message: 'User deactivated successfully',
      };
    } catch (error) {
      logger.error('Error deactivating user:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Permanently delete user from auth (cascades to all related tables)
   * This is a hard delete and cannot be undone
   */
  async deleteUser(userId: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      // Delete from auth.users - this will cascade delete from all related tables
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        logger.error('Error deleting user from auth:', authError);
        return {
          success: false,
          message: 'Failed to delete user',
          error: authError.message,
        };
      }

      logger.info(`User permanently deleted (with cascade): ${userId}`);

      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      logger.error('Error deleting user:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update user profile information
   */
  async updateUser(
    userId: string,
    userData: {
      name?: string;
      email?: string;
      phone?: string;
      age?: number;
      date_of_birth?: string;
      dupr_id?: string;
      role?: string;
      dupr_validated?: boolean;
      dupr_validation_error?: string | null;
      dupr_player_data?: any;
      dupr_validated_at?: string | null;
      dupr_validation_attempted_at?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      // Update profile in database
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (userData.name !== undefined) updateData.name = userData.name;
      if (userData.email !== undefined) updateData.email = userData.email;
      if (userData.phone !== undefined) updateData.phone = userData.phone;
      if (userData.age !== undefined) updateData.age = userData.age;
      if (userData.date_of_birth !== undefined)
        updateData.date_of_birth = userData.date_of_birth;
      if (userData.dupr_id !== undefined) updateData.dupr_id = userData.dupr_id;
      if (userData.role !== undefined) updateData.role = userData.role;
      if (userData.dupr_validated !== undefined)
        updateData.dupr_validated = userData.dupr_validated;
      if (userData.dupr_validation_error !== undefined)
        updateData.dupr_validation_error = userData.dupr_validation_error;
      if (userData.dupr_player_data !== undefined)
        updateData.dupr_player_data = userData.dupr_player_data;
      if (userData.dupr_validated_at !== undefined)
        updateData.dupr_validated_at = userData.dupr_validated_at;
      if (userData.dupr_validation_attempted_at !== undefined)
        updateData.dupr_validation_attempted_at =
          userData.dupr_validation_attempted_at;

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (profileError) {
        logger.error('Error updating user profile:', profileError);
        return {
          success: false,
          message: 'Failed to update user profile',
          error: profileError.message,
        };
      }

      // If email is updated, also update in auth
      if (userData.email) {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          userId,
          {
            email: userData.email,
            email_confirm: true,
            user_metadata: {
              role: userData.role,
              email: userData.email,
            },
          }
        );

        if (authError) {
          logger.error('Error updating user email in auth:', authError);
          // Don't fail the whole operation, just log the error
          logger.warn('Profile updated but auth email update failed');
        }
      }

      logger.info(`User updated successfully: ${userId}`);

      return {
        success: true,
        message: 'User updated successfully',
      };
    } catch (error) {
      logger.error('Error updating user:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Admin register user - Create new user without OTP verification
   * Used by admin panel to register users directly
   * IMPORTANT: This only creates NEW users, never updates existing ones
   */
  async adminRegisterUser(request: {
    phone: string;
    userData: {
      name: string;
      email: string;
      role: 'player' | 'organizer' | 'admin' | 'umpire';
      organizationName?: string;
      organizationDescription?: string;
      experience?: string;
      duprId?: string;
    };
  }): Promise<{
    success: boolean;
    user?: any;
    message: string;
    error?: string;
  }> {
    try {
      const { phone, userData } = request;

      logger.info(
        `Admin registering user for phone: ${phone.replace(
          /(.{3})(.*)(.{2})/,
          '$1***$3'
        )}`
      );

      // Step 1: Check if phone number already exists
      const { data: existingPhoneProfile } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .or(phoneOrCondition(phone))
        .single();

      if (existingPhoneProfile) {
        logger.warn(`Phone number already exists: ${phone}`);
        return {
          success: false,
          message: 'Phone number already exists',
          error: `This phone number is already registered to user: ${existingPhoneProfile.name}`,
        };
      }

      // Step 2: Check if email already exists
      const { data: existingEmailProfile } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('email', userData.email)
        .single();

      if (existingEmailProfile) {
        logger.warn(`Email already exists: ${userData.email}`);
        return {
          success: false,
          message: 'Email already exists',
          error: `This email is already registered to user: ${existingEmailProfile.name}`,
        };
      }

      // Step 3: Check if DUPR ID already exists (if provided)
      if (userData.duprId) {
        const { data: existingDuprProfile } = await supabase
          .from('profiles')
          .select('id, name, dupr_id')
          .eq('dupr_id', userData.duprId)
          .single();

        if (existingDuprProfile) {
          logger.warn(`DUPR ID already exists: ${userData.duprId}`);
          return {
            success: false,
            message: 'DUPR ID already exists',
            error: `This DUPR ID is already registered to user: ${existingDuprProfile.name}`,
          };
        }
      }

      // All validations passed - create new user
      let userId: string;

      // Create new user - create auth user and profile
      logger.info('Creating new user via admin');

      try {
        // Create auth user
        const { data: authUser, error: authError } =
          await supabase.auth.admin.createUser({
            phone: phone,
            email: userData.email,
            password: phone, // Use phone as password
            user_metadata: {
              phone: phone,
              role: userData.role,
              name: userData.name,
              email: userData.email,
              organization_name: userData.organizationName || null,
              organization_description:
                userData.organizationDescription || null,
              experience: userData.experience || null,
            },
            email_confirm: true, // Auto-confirm for admin-created users
          });

        if (authError) {
          logger.error('Error creating auth user:', authError);
          return {
            success: false,
            message: 'Failed to create user account',
            error: authError.message || 'Failed to create user account',
          };
        }

        userId = authUser.user.id;

        // Profile will be auto-created by database trigger
        // Wait a moment for trigger to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Fetch the created profile
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError || !newProfile) {
          logger.error('Profile not found after creation:', profileError);

          // If profile doesn't exist, create it manually
          const profileData = {
            id: userId,
            name: userData.name,
            email: userData.email,
            phone: phone,
            role: userData.role,
            dupr_id: userData.duprId || null,
            organization_name: userData.organizationName || null,
            organization_description: userData.organizationDescription || null,
            experience: userData.experience || null,
          };

          const { data: manualProfile, error: manualError } = await supabase
            .from('profiles')
            .insert([profileData])
            .select()
            .single();

          if (manualError) {
            logger.error('Error creating profile manually:', manualError);
            // Clean up auth user if profile creation fails
            await supabase.auth.admin.deleteUser(userId);
            return {
              success: false,
              message: 'Failed to create user profile',
              error: 'Failed to create user profile',
            };
          }

          logger.info(`User created successfully (manual profile): ${userId}`);

          return {
            success: true,
            user: manualProfile,
            message: 'User created successfully',
          };
        }

        logger.info(`User created successfully: ${userId}`);

        return {
          success: true,
          user: newProfile,
          message: 'User created successfully',
        };
      } catch (error) {
        logger.error('Exception during user creation:', error);
        return {
          success: false,
          message: 'Failed to create user',
          error: String(error),
        };
      }
    } catch (error) {
      logger.error('Error in adminRegisterUser service:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: String(error),
      };
    }
  }

  /**
   * Register user for bulk operations - returns existing user if phone exists
   * This is different from adminRegisterUser which rejects duplicates
   */
  async bulkRegisterUser(request: {
    phone: string;
    userData: {
      name: string;
      email: string;
      role: 'player' | 'organizer' | 'admin' | 'umpire';
      organizationName?: string;
      organizationDescription?: string;
      experience?: string;
      duprId?: string;
    };
  }): Promise<{
    success: boolean;
    user?: any;
    message: string;
    error?: string;
    isExisting?: boolean;
  }> {
    try {
      const { phone, userData } = request;

      logger.info(
        `Bulk registering user for phone: ${phone.replace(
          /(.{3})(.*)(.{2})/,
          '$1***$3'
        )}`
      );

      // Step 1: Check if phone number already exists
      const { data: existingPhoneProfile } = await supabase
        .from('profiles')
        .select('id, name, phone, email, role')
        .or(phoneOrCondition(phone))
        .single();

      if (existingPhoneProfile) {
        logger.info(
          `Phone number already exists, returning existing user: ${phone}`
        );
        return {
          success: true,
          user: existingPhoneProfile,
          message: 'User already exists',
          isExisting: true,
        };
      }

      // Step 2: Check if email already exists (only for new users)
      const { data: existingEmailProfile } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('email', userData.email)
        .single();

      if (existingEmailProfile) {
        logger.warn(`Email already exists: ${userData.email}`);
        return {
          success: false,
          message: 'Email already exists',
          error: `This email is already registered to user: ${existingEmailProfile.name}`,
        };
      }

      // Step 3: Check if DUPR ID already exists (if provided, only for new users)
      if (userData.duprId) {
        const { data: existingDuprProfile } = await supabase
          .from('profiles')
          .select('id, name, dupr_id')
          .eq('dupr_id', userData.duprId)
          .single();

        if (existingDuprProfile) {
          logger.warn(`DUPR ID already exists: ${userData.duprId}`);
          return {
            success: false,
            message: 'DUPR ID already exists',
            error: `This DUPR ID is already registered to user: ${existingDuprProfile.name}`,
          };
        }
      }

      // User doesn't exist - create new user using existing logic
      return await this.adminRegisterUser(request);
    } catch (error) {
      logger.error('Error in bulkRegisterUser service:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: String(error),
      };
    }
  }
}

export const userService = new UserService();
