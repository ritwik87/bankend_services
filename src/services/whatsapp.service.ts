import axios from 'axios';

export interface WhatsAppMessage {
  to: string;
  template: string;
  parameters?: string[];
}

export class WhatsAppService {
  private readonly apiUrl = 'https://api.whatsapp.com/v1/messages'; // Replace with actual WhatsApp Business API URL
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  constructor() {
    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('WhatsApp API credentials not configured');
    }
  }

  /**
   * Send booking confirmation message to user
   */
  async sendBookingConfirmationToUser(
    phoneNumber: string,
    userName: string,
    tournamentName: string,
    registrationDate: string,
    registrationId?: string
  ): Promise<void> {
    try {
      const message = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: 'registration_confirmation_league_user',
          language: {
            code: 'en',
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: userName,
                },
                {
                  type: 'text',
                  text: tournamentName,
                },
                {
                  type: 'text',
                  text: phoneNumber,
                },
                {
                  type: 'text',
                  text: registrationDate,
                },
                {
                  type: 'text',
                  text: registrationId || 'N/A',
                },
              ],
            },
          ],
        },
      };

      await this.sendMessage(message);
      console.log(`Booking confirmation sent to user: ${phoneNumber}`);
    } catch (error) {
      console.error('Error sending booking confirmation to user:', error);
      throw error;
    }
  }

  /**
   * Send manager notification when new player registers
   */
  async sendManagerNotification(
    managerPhoneNumber: string,
    playerName: string,
    playerPhone: string,
    tournamentName: string,
    registrationDate: string,
    registrationId?: string
  ): Promise<void> {
    try {
      const message = {
        messaging_product: 'whatsapp',
        to: managerPhoneNumber,
        type: 'template',
        template: {
          name: 'registration_confirmation_organizer',
          language: {
            code: 'en',
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: tournamentName,
                },
                {
                  type: 'text',
                  text: playerName,
                },
                {
                  type: 'text',
                  text: playerPhone,
                },
                {
                  type: 'text',
                  text: registrationDate,
                },
              ],
            },
          ],
        },
      };

      await this.sendMessage(message);
      console.log(`Manager notification sent to: ${managerPhoneNumber}`);
    } catch (error) {
      console.error('Error sending manager notification:', error);
      throw error;
    }
  }

  /**
   * Generic method to send WhatsApp message
   */
  private async sendMessage(message: any): Promise<void> {
    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('WhatsApp API not configured, skipping message send');
      return;
    }

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`,
        message,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('WhatsApp message sent successfully:', response.data);
    } catch (error) {
      console.error('WhatsApp API error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
      }
      throw error;
    }
  }

  /**
   * Send custom template message
   */
  async sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    parameters: string[] = []
  ): Promise<void> {
    try {
      const message = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en_US',
          },
          components: [
            {
              type: 'body',
              parameters: parameters.map((param) => ({
                type: 'text',
                text: param,
              })),
            },
          ],
        },
      };

      await this.sendMessage(message);
      console.log(`Template message '${templateName}' sent to: ${phoneNumber}`);
    } catch (error) {
      console.error(`Error sending template message '${templateName}':`, error);
      throw error;
    }
  }

  /**
   * Format phone number for WhatsApp (ensure it includes country code)
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-numeric characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    // If number doesn't start with country code, assume India (+91)
    if (!cleanNumber.startsWith('91') && cleanNumber.length === 10) {
      return `91${cleanNumber}`;
    }

    return cleanNumber;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber: string): boolean {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    return cleanNumber.length >= 10 && cleanNumber.length <= 15;
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();
