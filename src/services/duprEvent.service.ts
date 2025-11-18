import {
  DuprEventCreateRequest,
  DuprEventUpdateRequest,
  DuprEventDeleteRequest,
  DuprEventGetRequest,
  DuprEventResponse,
  EventV1,
} from '../types/dupr.types';
import logger from '../utils/logger';
import duprAuthService from './duprAuth.service';

class DuprEventService {
  private readonly apiVersion = 'v1.0';
  private readonly clubId?: number;

  constructor() {
    // Load club ID from environment variable
    const clubIdEnv = process.env.DUPR_CLUB_ID;
    this.clubId = clubIdEnv ? parseInt(clubIdEnv, 10) : undefined;
  }

  /**
   * Create an event in DUPR
   */
  async createEvent(
    eventData: EventV1
  ): Promise<DuprEventResponse> {
    try {
      // Validate event data
      this.validateEventData(eventData);

      const requestPayload: DuprEventCreateRequest = {
        event: eventData,
      };

      // Make authenticated request to DUPR
      const response = await duprAuthService.makeAuthenticatedRequest(
        `/events/${this.apiVersion}/create`,
        'POST',
        requestPayload
      );

      logger.info('DUPR event creation successful', {
        eventName: eventData.data.name,
        response: response.data,
      });

      // Extract event ID from response
      const eventId = response.data?.result?.eventId || response.data?.eventId;

      return {
        success: true,
        eventId: eventId,
        message: 'Event created successfully in DUPR',
        data: response.data,
      };
    } catch (error: any) {
      logger.error('DUPR event creation failed', {
        eventName: eventData.data.name,
        error: error.message,
        response: error.response?.data,
      });

      return {
        success: false,
        error:
          error.response?.data?.message || error.message || 'Event creation failed',
        message: 'Failed to create event in DUPR',
      };
    }
  }

  /**
   * Update an existing event in DUPR
   */
  async updateEvent(
    eventId: string,
    eventData: EventV1
  ): Promise<DuprEventResponse> {
    try {
      const requestPayload: DuprEventUpdateRequest = {
        events: {
          [eventId]: eventData,
        },
      };

      const response = await duprAuthService.makeAuthenticatedRequest(
        `/events/${this.apiVersion}/update`,
        'POST',
        requestPayload
      );

      logger.info('DUPR event update successful', {
        eventId,
        eventName: eventData.data.name,
      });

      return {
        success: true,
        eventId: eventId,
        message: 'Event updated successfully in DUPR',
        data: response.data,
      };
    } catch (error: any) {
      logger.error('DUPR event update failed', {
        eventId,
        error: error.message,
        response: error.response?.data,
      });

      return {
        success: false,
        error:
          error.response?.data?.message || error.message || 'Event update failed',
        message: 'Failed to update event in DUPR',
      };
    }
  }

  /**
   * Delete an event from DUPR
   */
  async deleteEvent(eventId: string): Promise<DuprEventResponse> {
    try {
      const requestPayload: DuprEventDeleteRequest = {
        eventIds: [eventId],
      };

      await duprAuthService.makeAuthenticatedRequest(
        `/events/${this.apiVersion}/delete`,
        'POST',
        requestPayload
      );

      logger.info('DUPR event deletion successful', {
        eventId,
      });

      return {
        success: true,
        eventId: eventId,
        message: 'Event deleted successfully from DUPR',
      };
    } catch (error: any) {
      logger.error('DUPR event deletion failed', {
        eventId,
        error: error.message,
        response: error.response?.data,
      });

      return {
        success: false,
        error:
          error.response?.data?.message || error.message || 'Event deletion failed',
        message: 'Failed to delete event from DUPR',
      };
    }
  }

  /**
   * Get event information from DUPR
   */
  async getEvent(eventId: string): Promise<DuprEventResponse> {
    try {
      const requestPayload: DuprEventGetRequest = {
        eventIds: [eventId],
      };

      const response = await duprAuthService.makeAuthenticatedRequest(
        `/events/${this.apiVersion}/get`,
        'GET',
        requestPayload
      );

      logger.info('DUPR event retrieval successful', {
        eventId,
      });

      return {
        success: true,
        eventId: eventId,
        message: 'Event information retrieved successfully',
        data: response.data,
      };
    } catch (error: any) {
      logger.error('DUPR event retrieval failed', {
        eventId,
        error: error.message,
        response: error.response?.data,
      });

      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          'Failed to retrieve event info',
        message: 'Failed to retrieve event information from DUPR',
      };
    }
  }

  /**
   * Validate event data before sending to DUPR
   */
  private validateEventData(eventData: EventV1): void {
    const errors: string[] = [];

    // Validate data fields
    if (!eventData.data) {
      errors.push('Event data is required');
    } else {
      if (!eventData.data.name) errors.push('Event name is required');
      if (!eventData.data.address) errors.push('Event address is required');
      if (!eventData.data.registrationUrl)
        errors.push('Event registration URL is required');
      if (typeof eventData.data.minRating !== 'number')
        errors.push('Minimum rating is required');
      if (typeof eventData.data.maxRating !== 'number')
        errors.push('Maximum rating is required');
      if (typeof eventData.data.minAge !== 'number')
        errors.push('Minimum age is required');
      if (typeof eventData.data.maxAge !== 'number')
        errors.push('Maximum age is required');
    }

    // Validate date fields
    if (!eventData.date) {
      errors.push('Event date is required');
    } else {
      if (!eventData.date.startTime)
        errors.push('Event start time is required');
      if (!eventData.date.endTime) errors.push('Event end time is required');

      // Validate date-time format
      if (eventData.date.startTime && !this.isValidDateTimeFormat(eventData.date.startTime)) {
        errors.push('Start time must be in ISO date-time format');
      }
      if (eventData.date.endTime && !this.isValidDateTimeFormat(eventData.date.endTime)) {
        errors.push('End time must be in ISO date-time format');
      }
    }

    // Validate metadata
    if (!eventData.metadata || !eventData.metadata.metadata) {
      errors.push('Event metadata is required');
    }

    // Validate text
    if (!eventData.text || !eventData.text.text) {
      errors.push('Event text is required');
    }

    if (errors.length > 0) {
      throw new Error(`Event validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Validate date-time format (ISO 8601)
   */
  private isValidDateTimeFormat(dateTimeString: string): boolean {
    try {
      const date = new Date(dateTimeString);
      return !isNaN(date.getTime()) && dateTimeString.includes('T');
    } catch {
      return false;
    }
  }

  /**
   * Helper method to build EventV1 object from simplified parameters
   */
  buildEvent(params: {
    name: string;
    address: string;
    registrationUrl: string;
    startTime: string; // ISO date-time format
    endTime: string; // ISO date-time format
    minRating?: number;
    maxRating?: number;
    minAge?: number;
    maxAge?: number;
    description?: string;
    metadata?: Record<string, string>;
  }): EventV1 {
    return {
      data: {
        name: params.name,
        address: params.address,
        registrationUrl: params.registrationUrl,
        minRating: params.minRating || 0,
        maxRating: params.maxRating || 10,
        minAge: params.minAge || 0,
        maxAge: params.maxAge || 100,
      },
      date: {
        startTime: params.startTime,
        endTime: params.endTime,
      },
      metadata: {
        metadata: {
          ...(params.metadata || {}),
          ...(this.clubId ? { clubId: this.clubId.toString() } : {}),
        },
      },
      text: {
        text: {
          description: params.description || '',
        },
      },
    };
  }
}

export default new DuprEventService();
