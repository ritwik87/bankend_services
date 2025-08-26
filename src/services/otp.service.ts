import { createClient } from '@supabase/supabase-js';
import {
  CompleteRegistrationRequest,
  CompleteRegistrationResponse,
  GenerateOtpRequest,
  GenerateOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  WhatsAppResponse,
} from '../types/otp.types';
import logger from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

class OtpService {
  /**
   * Generate and send OTP via WhatsApp
   */
  async generateOtp(request: GenerateOtpRequest): Promise<GenerateOtpResponse> {
    try {
      const { phone } = request;

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Set expiry time (5 minutes from now)
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + 5);

      // Check if user exists in profiles table
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role, name, email')
        .eq('phone', phone)
        .single();

      let userId = null;
      if (existingProfile) {
        userId = existingProfile.id;
        logger.info(
          `Existing user found for phone: ${phone.replace(
            /(.{3})(.*)(.{2})/,
            '$1***$3'
          )}`
        );
      } else {
        // For new users, we need to create auth user first due to foreign key constraint
        logger.info(
          `New user detected for phone: ${phone.replace(
            /(.{3})(.*)(.{2})/,
            '$1***$3'
          )}`
        );

        try {
          // Create auth user first (required for foreign key constraint)
          const { data: authUser, error: authError } =
            await supabase.auth.admin.createUser({
              phone: `+91${phone}`,
              email: `${phone}@yopmail.com`,
              password: `${phone}`,
              user_metadata: {
                phone: phone,
                role: 'guest',
                name: `User ${phone.slice(-4)}`, // Default name with last 4 digits
                email: `${phone}@yopmail.com`, // Temporary email for guest
                password: `${phone}`,
              },
              email_confirm: true, // Auto-confirm phone for OTP flow
            });

          if (authError) {
            logger.error('Error creating auth user:', authError);
            return {
              success: false,
              message: 'Failed to create user account',
              userExists: false,
              error: 'Failed to create user account',
            };
          }

          userId = authUser.user.id;

          // // Now create profile with valid auth user ID
          // const { error: profileError } = await supabase
          //   .from('profiles')
          //   .insert([
          //     {
          //       id: userId,
          //       name: `Guest User ${phone.slice(-4)}`, // Default name with last 4 digits
          //       email: `guest_${phone}@temp.local`, // Temporary email for guest
          //       phone: phone,
          //       role: 'guest',
          //     },
          //   ]);

          // if (profileError) {
          //   logger.error('Error creating guest profile:', profileError);
          //   // If profile creation fails, clean up the auth user
          //   await supabase.auth.admin.deleteUser(userId);
          //   return {
          //     success: false,
          //     message: 'Failed to create user profile',
          //     userExists: false,
          //     error: 'Failed to create user profile',
          //   };
          // }
        } catch (error) {
          logger.error('Exception during user creation:', error);
          return {
            success: false,
            message: 'Failed to create user',
            userExists: false,
            error: 'Failed to create user',
          };
        }
      }

      // Store OTP in database
      const { error: otpError } = await supabase.from('otps').insert([
        {
          user_id: userId,
          phone: phone,
          otp_code: otp,
          expiry_time: expiryTime.toISOString(),
          is_used: false,
        },
      ]);

      if (otpError) {
        logger.error('Error storing OTP:', otpError);
        return {
          success: false,
          message: 'Failed to generate OTP',
          userExists: !!existingProfile,
          error: 'Failed to generate OTP',
        };
      }

      // Send OTP via WhatsApp
      const whatsappResult = await this.sendOtpViaWhatsApp(phone, otp);

      if (!whatsappResult.success) {
        return {
          success: false,
          message: whatsappResult.message || 'Failed to send OTP via WhatsApp',
          userExists: !!existingProfile,
          error: whatsappResult.message || 'Failed to send OTP via WhatsApp',
        };
      }

      logger.info(`OTP generated and sent for phone: ${phone}`);

      return {
        success: true,
        message: 'OTP sent successfully via WhatsApp',
        userExists: !!existingProfile,
      };
    } catch (error) {
      logger.error('Error in generateOtp service:', error);
      return {
        success: false,
        message: 'Internal server error',
        userExists: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    try {
      const { phone, otp } = request;

      // Find the most recent unused OTP for this phone
      const { data: otpRecord, error: otpError } = await supabase
        .from('otps')
        .select('*')
        .eq('phone', phone)
        .eq('otp_code', otp)
        .eq('is_used', false)
        .gt('expiry_time', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (otpError || !otpRecord) {
        logger.error('Invalid or expired OTP:', otpError);
        return {
          success: false,
          userExists: false,
          error: 'Invalid or expired OTP',
        };
      }

      // Mark OTP as used
      const { error: updateError } = await supabase
        .from('otps')
        .update({ is_used: true })
        .eq('id', otpRecord.id);

      if (updateError) {
        logger.error('Error updating OTP status:', updateError);
        return {
          success: false,
          userExists: false,
          error: 'Failed to verify OTP',
        };
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone)
        .single();

      if (profileError || !userProfile) {
        logger.error('User profile not found:', profileError);
        return {
          success: false,
          userExists: false,
          error: 'User profile not found',
        };
      }

      // Create a simulated session response for the frontend
      // The frontend will need to use the user data to establish its own session
      let sessionData = null;
      if (userProfile.id) {
        // For now, return user information without actual session token
        // Frontend should implement its own session management after OTP verification
        sessionData = {
          user: {
            id: userProfile.id,
            email: userProfile.email,
            phone: phone,
            user_metadata: {
              name: userProfile.name,
              role: userProfile.role,
              phone: phone,
            },
          },
          verified: true,
        };
        logger.info('User data prepared for session');
      }

      logger.info(`OTP verified successfully for phone: ${phone}`);

      const userExists =
        userProfile.role !== 'guest' && userProfile.name && userProfile.email;

      return {
        success: true,
        userExists: !!userExists,
        user: {
          id: userProfile.id,
          role: userProfile.role,
          name: userProfile.name,
          email: userProfile.email,
          phone: phone,
        },
        session: sessionData,
      };
    } catch (error) {
      logger.error('Error in verifyOtp service:', error);
      return {
        success: false,
        userExists: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Complete user registration after OTP verification
   */
  async completeRegistration(
    request: CompleteRegistrationRequest
  ): Promise<CompleteRegistrationResponse> {
    try {
      const { phone, userData } = request;

      // Find user by phone
      const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone)
        .single();

      if (findError || !profile) {
        return {
          success: false,
          message: 'User not found',
          error: 'User not found',
        };
      }

      // Update profile with complete registration data
      const updateData = {
        name: userData.name || profile.name || `User ${phone.slice(-4)}`, // Ensure name is never empty
        email: userData.email || profile.email || `user_${phone}@temp.local`, // Ensure email is never empty
        role: userData.role || 'player',
        organization_name: userData.organizationName || null,
        organization_description: userData.organizationDescription || null,
        experience: userData.experience || null,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)
        .select()
        .single();

      if (updateError) {
        logger.error('Error updating profile:', updateError);
        return {
          success: false,
          message: 'Failed to complete registration',
          error: 'Failed to complete registration',
        };
      }

      // Update auth user with email when registration is completed
      if (
        userData.email &&
        (userData.role === 'player' || userData.role === 'organizer')
      ) {
        try {
          const { error: authUpdateError } =
            await supabase.auth.admin.updateUserById(profile.id, {
              email: userData.email,
              password: `${phone}`,
              user_metadata: {
                ...updatedProfile,
                phone: phone,
              },
              email_confirm: true,
            });

          if (authUpdateError) {
            logger.error(
              'Error updating auth user with email:',
              authUpdateError
            );
            // Continue with registration completion even if auth update fails
          }
          return { success: true, user: { ...userData, phone }, message: '' };
        } catch (error) {
          logger.error('Exception during auth user update:', error);
          // Continue with registration completion even if auth update fails
        }
      }

      logger.info(`Registration completed for phone: ${phone}`);

      return {
        success: true,
        user: updatedProfile,
        message: 'Registration completed successfully',
      };
    } catch (error) {
      logger.error('Error in completeRegistration service:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: 'Internal server error',
      };
    }
  }

  /**
   * Send OTP via WhatsApp using Meta's WhatsApp Business API
   */
  private async sendOtpViaWhatsApp(
    phone: string,
    otp: string
  ): Promise<WhatsAppResponse> {
    try {
      const response = await fetch(
        'https://graph.facebook.com/v21.0/495903543611619/messages/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: '+91' + phone,
            type: 'template',
            template: {
              name: 'order_details',
              language: {
                code: 'en_US',
              },
              components: [
                {
                  type: 'body',
                  parameters: [
                    {
                      type: 'text',
                      text: otp,
                    },
                  ],
                },
              ],
            },
          }),
        }
      );

      const otpVerificationResponse = (await response.json()) as any;

      if (response.ok) {
        logger.info('OTP sent via WhatsApp:', otpVerificationResponse);
        return { success: true };
      } else {
        logger.error('WhatsApp API error:', otpVerificationResponse);
        return {
          success: false,
          message:
            otpVerificationResponse.error?.message ||
            'Failed to send OTP via WhatsApp',
        };
      }
    } catch (error) {
      logger.error('Error sending OTP via WhatsApp:', error);
      return { success: false, message: 'Failed to send OTP via WhatsApp' };
    }
  }
}

export const otpService = new OtpService();
