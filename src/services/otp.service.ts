import dummyPlayersData from '../../complete_dummy_players.json';
import {
  CompleteRegistrationRequest,
  CompleteRegistrationResponse,
  GenerateOtpRequest,
  GenerateOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  WhatsAppResponse,
} from '../types/otp.types';
import { phoneOrCondition } from '../utils/helper';
import logger from '../utils/logger';
import { supabase } from '../utils/supabase';

// Convert JSON array to object with phone as key for easy lookup - Contains 114 total users (6 original + 108 new players)
const DUMMY_USERS = dummyPlayersData.reduce((acc, user) => {
  acc[user.phone] = user;
  return acc;
}, {} as Record<string, (typeof dummyPlayersData)[0]>);

// Helper function to check if phone is a dummy user
const isDummyUser = (phone: string): boolean => {
  return Object.prototype.hasOwnProperty.call(DUMMY_USERS, phone);
};

// Helper function to get dummy user data
const getDummyUser = (phone: string) => {
  const mobile = phone?.split('+91')?.[1] || phone;
  return DUMMY_USERS[mobile as keyof typeof DUMMY_USERS] || null;
};

class OtpService {
  /**
   * Generate and send OTP via WhatsApp
   */
  async generateOtp(request: GenerateOtpRequest): Promise<GenerateOtpResponse> {
    try {
      const { phone } = request;

      // Check if this is a dummy user
      const dummyUser = getDummyUser(phone);
      let otp: string;
      let shouldSendOtp = false;

      if (dummyUser) {
        // Use static OTP for dummy users
        otp = dummyUser.otp;
        shouldSendOtp = false;
        logger.info(`Using static OTP for dummy user: ${phone}`);
      } else {
        // Generate 6-digit OTP for real users
        otp = Math.floor(100000 + Math.random() * 900000).toString();
      }

      // Set expiry time (5 minutes from now)
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + 1);

      // Check if user exists in profiles table
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role, name, email')
        .or(phoneOrCondition(phone))
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
        // Check if this is a dummy user that needs to be created
        if (dummyUser) {
          logger.info(`Creating dummy user for phone: ${phone}`);
          try {
            // Create auth user first (required for foreign key constraint)
            const { data: authUser, error: authError } =
              await supabase.auth.admin.createUser({
                phone: `+91${phone.split('+91')?.[1]}`,
                email: dummyUser.email,
                password: dummyUser.password,
                user_metadata: {
                  phone: dummyUser.phone,
                  role: dummyUser.role,
                  name: dummyUser.name,
                  email: dummyUser.email,
                  password: dummyUser.password,
                },
                email_confirm: true, // Auto-confirm for dummy users
              });

            if (authError) {
              logger.error('Error creating dummy auth user:', authError);
              return {
                success: false,
                message: 'Failed to create dummy user account',
                userExists: false,
                error: 'Failed to create dummy user account',
              };
            }

            userId = authUser.user.id;

            // Create dummy user profile
            // const { error: profileError } = await supabase
            //   .from('profiles')
            //   .insert([
            //     {
            //       id: userId,
            //       name: dummyUser.name,
            //       email: dummyUser.email,
            //       phone: dummyUser.phone,
            //       role: dummyUser.role,
            //     },
            //   ]);

            // if (profileError) {
            //   logger.error('Error creating dummy profile:', profileError);
            //   // If profile creation fails, clean up the auth user
            //   await supabase.auth.admin.deleteUser(userId);
            //   return {
            //     success: false,
            //     message: 'Failed to create dummy user profile',
            //     userExists: false,
            //     error: 'Failed to create dummy user profile',
            //   };
            // }

            logger.info(`Dummy user created successfully for phone: ${phone}`);
          } catch (error) {
            logger.error('Exception during dummy user creation:', error);
            return {
              success: false,
              message: 'Failed to create dummy user',
              userExists: false,
              error: 'Failed to create dummy user',
            };
          }
        } else {
          // For new regular users, we need to create auth user first due to foreign key constraint
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
                phone: `${phone}`,
                email: `${phone}@yopmail.com`,
                password: `${phone}`,
                user_metadata: {
                  phone: phone,
                  role: 'guest', // Default to player for partner registration
                  name: `guest ${phone.slice(-4)}`, // Default name with last 4 digits
                  email: `${phone}@yopmail.com`, // Temporary email
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
      }

      // Store OTP in database
      const { error: otpError } = await supabase.from('otps').upsert([
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

      // Send OTP via WhatsApp (skip for dummy users)
      if (shouldSendOtp) {
        const whatsappResult = await this.sendOtpViaWhatsApp(phone, otp);

        if (!whatsappResult.success) {
          return {
            success: false,
            message:
              whatsappResult.message || 'Failed to send OTP via WhatsApp',
            userExists: !!existingProfile,
            error: whatsappResult.message || 'Failed to send OTP via WhatsApp',
          };
        }
      } else {
        logger.info(`Skipping WhatsApp OTP for dummy user: ${phone}`);
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
      const { phone, otp, type } = request;

      // Find the most recent unused OTP for this phone
      const { data: otpRecord, error: otpError } = await supabase
        .from('otps')
        .select('*')
        .or(phoneOrCondition(phone))
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
        .or(phoneOrCondition(phone))
        .single();

      if (type !== 'fromLogin' && (profileError || !userProfile)) {
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
        .or(phoneOrCondition(phone))
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
          return {
            success: true,
            user: updatedProfile,
            message: 'Registration completed successfully',
          };
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
            to: phone,
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

  /**
   * Generate OTP specifically for partner registration (creates player role by default)
   */
  async generatePartnerOtp(
    request: GenerateOtpRequest
  ): Promise<GenerateOtpResponse> {
    try {
      const { phone } = request;

      // Check if this is a dummy user
      const dummyUser = getDummyUser(phone);
      // ==================== OTP GENERATION COMMENTED OUT (FUTURE USE) ====================
      // NOTE: OTP generation is skipped for direct partner registration
      // Uncomment this section to re-enable OTP for partners
      /*
      let otp: string;
      let shouldSendOtp = true;

      if (dummyUser) {
        // Use static OTP for dummy users
        otp = dummyUser.otp;
        shouldSendOtp = false;
        logger.info(`Using static OTP for dummy user partner: ${phone}`);
      } else {
        // Generate 6-digit OTP for real users
        otp = Math.floor(100000 + Math.random() * 900000).toString();
      }

      // Set expiry time (5 minutes from now)
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + 1);
      */
      // ==================== END OTP GENERATION ====================

      // Check if user exists in profiles table
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role, name, email')
        .or(phoneOrCondition(phone))
        .single();

      let userId = null;
      if (existingProfile) {
        userId = existingProfile.id;
        logger.info(
          `Existing user found for partner phone: ${phone.replace(
            /(.{3})(.*)(.{2})/,
            '$1***$3'
          )}`
        );
      } else {
        // Check if this is a dummy user that needs to be created
        if (dummyUser) {
          logger.info(`Creating dummy user for partner phone: ${phone}`);
          try {
            const { data: authUser, error: authError } =
              await supabase.auth.admin.createUser({
                phone: `+91${phone.split('+91')?.[1]}`,
                email: dummyUser.email,
                password: dummyUser.password,
                user_metadata: {
                  phone: dummyUser.phone,
                  role: dummyUser.role,
                  name: dummyUser.name,
                  email: dummyUser.email,
                  password: dummyUser.password,
                },
                email_confirm: true,
              });

            if (authError) {
              logger.error(
                'Error creating dummy auth user for partner:',
                authError
              );
              return {
                success: false,
                message: 'Failed to create dummy user account',
                userExists: false,
                error: 'Failed to create dummy user account',
              };
            }

            userId = authUser.user.id;

            // Create profile
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([
                {
                  id: authUser.user.id,
                  name: dummyUser.name,
                  email: dummyUser.email,
                  phone: dummyUser.phone,
                  role: dummyUser.role,
                },
              ]);

            if (profileError) {
              logger.error(
                'Error creating dummy profile for partner:',
                profileError
              );
              await supabase.auth.admin.deleteUser(authUser.user.id);
              return {
                success: false,
                message: 'Failed to create dummy user profile',
                userExists: false,
                error: 'Failed to create dummy user profile',
              };
            }

            logger.info(
              `Dummy user created successfully for partner phone: ${phone}`
            );
          } catch (error) {
            logger.error(
              'Exception during dummy user creation for partner:',
              error
            );
            return {
              success: false,
              message: 'Failed to create dummy user',
              userExists: false,
              error: 'Failed to create dummy user',
            };
          }
        } else {
          // For new regular users, create as player by default for partner registration
          logger.info(
            `New partner user detected for phone: ${phone.replace(
              /(.{3})(.*)(.{2})/,
              '$1***$3'
            )}`
          );

          try {
            const { data: authUser, error: authError } =
              await supabase.auth.admin.createUser({
                phone: `${phone}`,
                email: `${phone}@yopmail.com`,
                password: `${phone}`,
                user_metadata: {
                  phone: phone,
                  role: 'player', // Default to player for partner registration
                  name: `Player ${phone.slice(-4)}`,
                  email: `${phone}@yopmail.com`,
                  password: `${phone}`,
                },
                email_confirm: true,
              });

            if (authError) {
              logger.error('Error creating auth user for partner:', authError);
              return {
                success: false,
                message: 'Failed to create user account',
                userExists: false,
                error: 'Failed to create user account',
              };
            }

            userId = authUser.user.id;

            // Create profile
            // const { error: profileError } = await supabase
            //   .from('profiles')
            //   .insert([
            //     {
            //       id: authUser.user.id,
            //       name: `Player ${phone.slice(-4)}`,
            //       email: `${phone}@yopmail.com`,
            //       phone: phone,
            //       role: 'player',
            //     },
            //   ]);

            // if (profileError) {
            //   logger.error('Error creating profile for partner:', profileError);
            //   await supabase.auth.admin.deleteUser(authUser.user.id);
            //   return {
            //     success: false,
            //     message: 'Failed to create user profile',
            //     userExists: false,
            //     error: 'Failed to create user profile',
            //   };
            // }
          } catch (error) {
            logger.error('Exception during partner user creation:', error);
            return {
              success: false,
              message: 'Failed to create user',
              userExists: false,
              error: 'Failed to create user',
            };
          }
        }
      }

      // ==================== OTP STORAGE & SENDING COMMENTED OUT (FUTURE USE) ====================
      // NOTE: OTP storage and WhatsApp sending is skipped for direct partner registration
      // Uncomment this section to re-enable OTP verification
      /*
      // Store OTP in database
      const { error: otpError } = await supabase.from('otps').upsert([
        {
          user_id: userId,
          phone: phone,
          otp_code: otp,
          expiry_time: expiryTime.toISOString(),
          is_used: false,
        },
      ]);

      if (otpError) {
        logger.error('Error storing OTP for partner:', otpError);
        return {
          success: false,
          message: 'Failed to generate OTP',
          userExists: !!existingProfile,
          error: 'Failed to generate OTP',
        };
      }

      // Send OTP via WhatsApp (skip for dummy users)
      if (shouldSendOtp) {
        const whatsappResult = await this.sendOtpViaWhatsApp(phone, otp);

        if (!whatsappResult.success) {
          return {
            success: false,
            message:
              whatsappResult.message || 'Failed to send OTP via WhatsApp',
            userExists: !!existingProfile,
            error: whatsappResult.message || 'Failed to send OTP via WhatsApp',
          };
        }
      } else {
        logger.info(`Skipping WhatsApp OTP for dummy partner user: ${phone}`);
      }

      logger.info(`Partner OTP generated and sent for phone: ${phone}`);
      */
      // ==================== END OTP STORAGE & SENDING ====================

      logger.info(
        `Partner user created/validated successfully for phone: ${phone}`
      );

      return {
        success: true,
        message: 'Partner user validated successfully',
        userExists: !!existingProfile,
      };
    } catch (error) {
      logger.error('Error in generatePartnerOtp service:', error);
      return {
        success: false,
        message: 'Internal server error',
        userExists: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Validate partner - check if phone belongs to a registered player
   */
  async validatePartner(request: { phone: string }) {
    try {
      const { phone } = request;

      // Check if this is a dummy user first
      const dummyUser = getDummyUser(phone);
      if (dummyUser) {
        logger.info(`Validating dummy user partner: ${phone}`);

        // For dummy users, check if they exist in database, if not create them
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, role, name, email')
          .or(phoneOrCondition(phone))
          .single();

        if (!existingProfile) {
          // Create dummy user automatically
          try {
            const { data: authUser, error: authError } =
              await supabase.auth.admin.createUser({
                phone: `${phone}`,
                email: dummyUser.email,
                password: dummyUser.password,
                user_metadata: {
                  phone: dummyUser.phone,
                  role: dummyUser.role,
                  name: dummyUser.name,
                  email: dummyUser.email,
                  password: dummyUser.password,
                },
                email_confirm: true,
              });

            if (authError) {
              logger.error(
                'Error creating dummy auth user for partner:',
                authError
              );
              return {
                success: false,
                userExists: false,
                isPlayer: false,
                error: 'Failed to create dummy user',
              };
            }

            // Create profile
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([
                {
                  id: authUser.user.id,
                  name: dummyUser.name,
                  email: dummyUser.email,
                  phone: dummyUser.phone,
                  role: dummyUser.role,
                },
              ]);

            if (profileError) {
              logger.error(
                'Error creating dummy profile for partner:',
                profileError
              );
              await supabase.auth.admin.deleteUser(authUser.user.id);
              return {
                success: false,
                userExists: false,
                isPlayer: false,
                error: 'Failed to create dummy user profile',
              };
            }

            logger.info(`Created dummy user for partner validation: ${phone}`);
          } catch (error) {
            logger.error('Exception creating dummy user for partner:', error);
            return {
              success: false,
              userExists: false,
              isPlayer: false,
              error: 'Failed to create dummy user',
            };
          }
        }

        // For dummy users, return their configured role validation
        const isPlayer = dummyUser.role !== 'guest';
        if (!isPlayer) {
          return {
            success: false,
            userExists: true,
            isPlayer: false,
            error: 'Only registered players can be selected as partners',
          };
        }

        return {
          success: true,
          userExists: true,
          isPlayer: true,
          user: {
            id: existingProfile?.id || 'dummy-id',
            role: dummyUser.role,
            name: dummyUser.name,
            email: dummyUser.email,
            phone: phone,
          },
          error: null,
        };
      }

      // For non-dummy users, create user if needed (but skip OTP)
      // This creates the user flow same as main login but without OTP verification
      const result = await this.generatePartnerOtp({ phone });

      if (!result.success) {
        return {
          success: false,
          userExists: false,
          isPlayer: false,
          error: result.error,
        };
      }

      // Check if user exists after user creation (which creates guest users)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(
          'id, role, name, email, phone, age, dupr_id, profile_picture_url, profile_picture_crop_metadata, date_of_birth, role, gender, tshirt_size'
        )
        .or(phoneOrCondition(phone))
        .single();

      if (error || !profile) {
        // User still doesn't exist even after creation attempt
        return {
          success: false,
          userExists: false,
          isPlayer: false,
          error: 'Failed to create partner user',
        };
      }
      if (profile.role === 'guest') {
        try {
          // Update auth metadata
          const { error: authUpdateError } =
            await supabase.auth.admin.updateUserById(profile.id, {
              user_metadata: {
                // ...profile,
                role: 'player',
              },
            });

          if (authUpdateError) {
            logger.error('Auth role update failed:', authUpdateError);
            return {
              success: false,
              userExists: true,
              isPlayer: false,
              error: 'Failed to upgrade user role',
            };
          }

          // Update profiles table
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({ role: 'player' })
            .eq('id', profile.id);

          if (profileUpdateError) {
            logger.error('Profile role update failed:', profileUpdateError);
            return {
              success: false,
              userExists: true,
              isPlayer: false,
              error: 'Failed to upgrade user role',
            };
          }

          // 3️⃣ Update local object so rest of logic works correctly
          profile.role = 'player';
        } catch (error) {
          logger.error('Error upgrading guest to player:', error);
          return {
            success: false,
            userExists: true,
            isPlayer: false,
            error: 'Internal server error',
          };
        }
      }

      // Check if user is a registered player (not guest)
      const isPlayer =
        profile.role !== 'guest' && profile.name && profile.email;

      if (!isPlayer) {
        // Check if this is a guest who needs to complete registration
        if (profile.role === 'guest' || !profile.name || !profile.email) {
          return {
            success: true,
            userExists: true,
            isPlayer: false,
            needsRegistration: true,
            user: {
              ...profile,
              id: profile.id,
              role: profile.role,
              name: profile.name || '',
              email: profile.email || '',
              phone: phone,
            },
            error: null,
          };
        }

        // User exists but is not a player (admin, organizer, etc.)
        let errorMessage;
        if (profile.role !== 'player') {
          errorMessage = 'Only registered players can be selected as partners';
        } else {
          errorMessage = 'Partner profile is incomplete';
        }

        return {
          success: false,
          userExists: true,
          isPlayer: false,
          error: errorMessage,
        };
      }

      return {
        success: true,
        userExists: true,
        isPlayer: true,
        user: {
          ...profile,
          id: profile.id,
          role: profile.role,
          name: profile.name,
          email: profile.email,
          phone: phone,
        },
        error: null,
      };
    } catch (error) {
      logger.error('Error in validatePartner service:', error);
      return {
        success: false,
        userExists: false,
        isPlayer: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Verify OTP for partner without affecting main session
   */
  async verifyPartnerOtp(request: { phone: string; otp: string }) {
    try {
      const { phone, otp } = request;

      // Check if this is a dummy user first
      const dummyUser = getDummyUser(phone);
      if (dummyUser) {
        logger.info(`Verifying OTP for dummy user partner: ${phone}`);

        // For dummy users, check if the OTP matches the static OTP
        if (otp !== dummyUser.otp) {
          logger.warn(`Invalid static OTP for dummy user: ${phone}`);
          return {
            success: false,
            error: 'Invalid or expired OTP',
          };
        }

        // Get or ensure dummy user profile exists
        let { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .or(phoneOrCondition(phone))
          .single();

        if (!userProfile) {
          // Create dummy user if doesn't exist
          try {
            const { data: authUser, error: authError } =
              await supabase.auth.admin.createUser({
                phone: `${phone}`,
                email: dummyUser.email,
                password: dummyUser.password,
                user_metadata: {
                  phone: dummyUser.phone,
                  role: dummyUser.role,
                  name: dummyUser.name,
                  email: dummyUser.email,
                  password: dummyUser.password,
                },
                email_confirm: true,
              });

            if (authError) {
              logger.error('Error creating dummy auth user:', authError);
              return {
                success: false,
                error: 'Failed to create dummy user',
              };
            }

            const { error: profileError } = await supabase
              .from('profiles')
              .insert([
                {
                  id: authUser.user.id,
                  name: dummyUser.name,
                  email: dummyUser.email,
                  phone: dummyUser.phone,
                  role: dummyUser.role,
                },
              ]);

            if (profileError) {
              logger.error('Error creating dummy profile:', profileError);
              await supabase.auth.admin.deleteUser(authUser.user.id);
              return {
                success: false,
                error: 'Failed to create dummy user profile',
              };
            }

            // Fetch the newly created profile
            const { data: newProfile } = await supabase
              .from('profiles')
              .select('*')
              .or(phoneOrCondition(phone))
              .single();

            userProfile = newProfile;
            logger.info(
              `Created dummy user during partner verification: ${phone}`
            );
          } catch (error) {
            logger.error(
              'Exception creating dummy user during partner verification:',
              error
            );
            return {
              success: false,
              error: 'Failed to create dummy user',
            };
          }
        }

        // Validate that dummy user is a guest
        if (userProfile.role === 'guest') {
          return {
            success: false,
            error: 'Only registered players can be selected as partners',
          };
        }

        logger.info(
          `Dummy partner OTP verified successfully for phone: ${phone}`
        );
        return {
          success: true,
          user: {
            id: userProfile.id,
            role: userProfile.role,
            name: userProfile.name,
            email: userProfile.email,
            phone: phone,
          },
        };
      }

      // Regular user OTP verification logic
      const { data: otpRecord, error: otpError } = await supabase
        .from('otps')
        .select('*')
        .or(phoneOrCondition(phone))
        .eq('otp_code', otp)
        .eq('is_used', false)
        .gte('expiry_time', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (otpError || !otpRecord) {
        logger.warn(`Invalid or expired OTP for phone: ${phone}`);
        return {
          success: false,
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
          error: 'Failed to verify OTP',
        };
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .or(phoneOrCondition(phone))
        .single();

      if (profileError || !userProfile) {
        logger.error('User profile not found:', profileError);
        return {
          success: false,
          error: 'User profile not found',
        };
      }

      // Only reject if they are registered as guest
      if (userProfile.role === 'guest') {
        return {
          success: false,
          error: 'Only registered players can be selected as partners',
        };
      }

      // Check if user needs to complete registration (guest role or missing name/email)
      const needsRegistration =
        userProfile.role === 'guest' ||
        !userProfile.name ||
        userProfile.name.startsWith('guest ') ||
        !userProfile.email ||
        userProfile.email.includes('@yopmail.com');

      logger.info(`Partner OTP verified successfully for phone: ${phone}`);

      return {
        success: true,
        needsRegistration,
        user: {
          id: userProfile.id,
          role: userProfile.role,
          name: userProfile.name,
          email: userProfile.email,
          phone: phone,
        },
      };
    } catch (error) {
      logger.error('Error in verifyPartnerOtp service:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Initialize dummy users in the database
   */
  async initializeDummyUsers() {
    try {
      logger.info('Initializing dummy users...');
      const results = [];

      for (const [phone, dummyUser] of Object.entries(DUMMY_USERS)) {
        try {
          // Check if user already exists
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, role, name, email')
            .or(phoneOrCondition(phone))
            .single();

          if (existingProfile) {
            logger.info(`Dummy user ${phone} already exists, skipping...`);
            results.push({ phone, status: 'exists', user: existingProfile });
            continue;
          }

          // Create auth user first
          const { data: authUser, error: authError } =
            await supabase.auth.admin.createUser({
              phone: `+91${phone}`,
              email: dummyUser.email,
              password: dummyUser.password,
              user_metadata: {
                phone: dummyUser.phone,
                role: dummyUser.role,
                name: dummyUser.name,
                email: dummyUser.email,
                password: dummyUser.password,
              },
              email_confirm: true,
            });

          if (authError) {
            logger.error(`Error creating auth user for ${phone}:`, authError);
            results.push({ phone, status: 'error', error: authError.message });
            continue;
          }

          // Create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: authUser.user.id,
                name: dummyUser.name,
                email: dummyUser.email,
                phone: dummyUser.phone,
                role: dummyUser.role,
              },
            ]);

          if (profileError) {
            logger.error(`Error creating profile for ${phone}:`, profileError);
            // Clean up auth user if profile creation fails
            await supabase.auth.admin.deleteUser(authUser.user.id);
            results.push({
              phone,
              status: 'error',
              error: profileError.message,
            });
            continue;
          }

          logger.info(
            `Successfully created dummy user: ${phone} (${dummyUser.name})`
          );
          results.push({
            phone,
            status: 'created',
            user: {
              id: authUser.user.id,
              name: dummyUser.name,
              email: dummyUser.email,
              role: dummyUser.role,
            },
          });
        } catch (error) {
          logger.error(`Exception creating dummy user ${phone}:`, error);
          results.push({ phone, status: 'error', error: String(error) });
        }
      }

      logger.info('Dummy users initialization completed');
      return {
        success: true,
        message: 'Dummy users initialization completed',
        results,
      };
    } catch (error) {
      logger.error('Error in initializeDummyUsers:', error);
      return {
        success: false,
        message: 'Failed to initialize dummy users',
        error: String(error),
      };
    }
  }
}

export const otpService = new OtpService();
