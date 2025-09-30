import axios from 'axios';
import { DuprAuthToken } from '../types/dupr.types';
import logger from '../utils/logger';

class DuprAuthService {
  private token: DuprAuthToken | null = null;
  private readonly baseUrl: string;
  private readonly clientKey: string;
  private readonly clientSecret: string;
  private readonly apiVersion: string;

  constructor() {
    this.baseUrl =
      process.env.DUPR_API_BASE_URL || 'https://uat.mydupr.com/api';
    this.apiVersion = process.env.DUPR_API_VERSION || 'v1.0';
    this.clientKey = process.env.DUPR_CLIENT_KEY || '';
    this.clientSecret = process.env.DUPR_CLIENT_SECRET || '';

    if (!this.clientKey || !this.clientSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('DUPR client credentials are required');
      } else {
        logger.warn(
          'DUPR credentials not configured - running in development mode'
        );
      }
    }
  }

  private encodeCredentials(): string {
    const credentials = `${this.clientKey}:${this.clientSecret}`;
    return Buffer.from(credentials).toString('base64');
  }

  private isTokenValid(): boolean {
    if (!this.token) return false;

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = this.token.created_at + this.token.result.expiry;

    return now < new Date(expiresAt).getTime() - 300; // Refresh 5 minutes before expiry
  }

  async getAuthToken(): Promise<string> {
    if (this.isTokenValid() && this.token) {
      return this.token.result.token;
    }

    if (!this.clientKey || !this.clientSecret) {
      throw new Error('DUPR credentials not configured');
    }

    try {
      const encodedCredentials = this.encodeCredentials();

      const response = await axios.post(
        `${this.baseUrl}/auth/${this.apiVersion}/token`,
        {},
        {
          headers: {
            'x-authorization': `${encodedCredentials}`,
            accept: 'application/json',
          },
        }
      );

      this.token = {
        ...response.data,
        created_at: Math.floor(Date.now() / 1000),
      };

      logger.info('DUPR authentication token obtained successfully');
      return this.token!.result.token;
    } catch (error) {
      logger.error('Failed to obtain DUPR auth token', error);
      throw new Error('DUPR authentication failed');
    }
  }

  async makeAuthenticatedRequest(
    url: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    data?: any
  ) {
    const token = await this.getAuthToken();

    return axios({
      method,
      url: `${this.baseUrl}${url}`,
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accept: '*/*',
      },
    });
  }
}

export default new DuprAuthService();
