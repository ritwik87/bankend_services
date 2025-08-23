import { Request, Response } from 'express';
import { DuprController } from './duprController';
import duprPlayerService from '../services/duprPlayer.service';

// Mock the service
jest.mock('../services/duprPlayer.service');
const mockDuprPlayerService = duprPlayerService as jest.Mocked<typeof duprPlayerService>;

describe('DuprController', () => {
  let controller: DuprController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new DuprController();
    
    mockRequest = {
      body: {},
      params: {},
      query: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('validatePlayer', () => {
    it('should validate player successfully', async () => {
      // Arrange
      const mockPlayerData = {
        id: '4581541063',
        firstName: 'John',
        lastName: 'Doe',
        duprId: '4581541063',
        singlesRating: 4.25,
        doublesRating: 4.15,
        reliability: 85,
        isActive: true,
        createdAt: '2023-01-15T10:30:00Z',
        updatedAt: '2024-01-20T14:22:00Z'
      };

      const mockValidationResponse = {
        isValid: true,
        player: mockPlayerData
      };

      mockRequest.body = {
        duprId: '4581541063',
        email: 'john.doe@example.com'
      };

      mockDuprPlayerService.validatePlayer.mockResolvedValue(mockValidationResponse);

      // Act
      await controller.validatePlayer(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockDuprPlayerService.validatePlayer).toHaveBeenCalledWith({
        duprId: '4581541063',
        email: 'john.doe@example.com'
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockValidationResponse,
        message: 'Player validated successfully'
      });
    });

    it('should handle validation failure', async () => {
      // Arrange
      const mockValidationResponse = {
        isValid: false,
        error: 'Player not found in DUPR database'
      };

      mockRequest.body = {
        duprId: 'invalid-id'
      };

      mockDuprPlayerService.validatePlayer.mockResolvedValue(mockValidationResponse);

      // Act
      await controller.validatePlayer(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        data: mockValidationResponse,
        message: 'Player validation failed'
      });
    });

    it('should handle validation errors', async () => {
      // Arrange
      mockRequest.body = {
        // Missing duprId to trigger validation error
        email: 'test@example.com'
      };

      // Act
      await controller.validatePlayer(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Validation error'),
          message: 'Failed to validate player'
        })
      );
    });
  });

  describe('getPlayerRating', () => {
    it('should get player rating successfully', async () => {
      // Arrange
      const mockRatingResponse = {
        duprId: '4581541063',
        singlesRating: 4.25,
        doublesRating: 4.15,
        reliability: 85,
        lastUpdated: '2024-01-20T14:22:00Z'
      };

      mockRequest.params = { duprId: '4581541063' };
      mockDuprPlayerService.getPlayerRating.mockResolvedValue(mockRatingResponse);

      // Act
      await controller.getPlayerRating(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockDuprPlayerService.getPlayerRating).toHaveBeenCalledWith('4581541063');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRatingResponse,
        message: 'Player rating retrieved successfully'
      });
    });

    it('should handle player not found', async () => {
      // Arrange
      mockRequest.params = { duprId: 'non-existent-id' };
      mockDuprPlayerService.getPlayerRating.mockResolvedValue(null);

      // Act
      await controller.getPlayerRating(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Rating not found',
        message: 'Player rating could not be retrieved'
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      // Act
      await controller.healthCheck(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: 'healthy',
          timestamp: expect.any(String)
        },
        message: 'DUPR service is healthy'
      });
    });
  });
});