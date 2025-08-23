import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DUPR Service API',
      version: '1.0.0',
      description: 'A Node.js/Express TypeScript service for integrating with the DUPR (Dynamic Universal Pickleball Rating) API to validate player IDs and retrieve ratings for tournament management systems.',
      contact: {
        name: 'Tournament Management Team',
        email: 'support@tournament-management.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.tournament-management.com',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful'
            },
            data: {
              type: 'object',
              description: 'Response data (varies by endpoint)',
              nullable: true
            },
            error: {
              type: 'string',
              description: 'Error message if request failed',
              nullable: true
            },
            message: {
              type: 'string',
              description: 'Human-readable message about the operation'
            }
          },
          required: ['success']
        },
        DuprPlayer: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Player ID in DUPR system'
            },
            firstName: {
              type: 'string',
              description: 'Player first name'
            },
            lastName: {
              type: 'string',
              description: 'Player last name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Player email address',
              nullable: true
            },
            phone: {
              type: 'string',
              description: 'Player phone number',
              nullable: true
            },
            duprId: {
              type: 'string',
              description: 'DUPR ID (same as id)'
            },
            singlesRating: {
              type: 'number',
              format: 'float',
              minimum: 2.000,
              maximum: 8.000,
              description: 'DUPR singles rating',
              nullable: true
            },
            doublesRating: {
              type: 'number',
              format: 'float',
              minimum: 2.000,
              maximum: 8.000,
              description: 'DUPR doubles rating',
              nullable: true
            },
            reliability: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              description: 'DUPR reliability score (1-100%)',
              nullable: true
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the player account is active'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          },
          required: ['id', 'firstName', 'lastName', 'duprId', 'isActive', 'createdAt', 'updatedAt']
        },
        DuprValidationRequest: {
          type: 'object',
          properties: {
            duprId: {
              type: 'string',
              description: 'DUPR player ID to validate',
              minLength: 1,
              maxLength: 50
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Optional email for verification',
              nullable: true
            },
            phone: {
              type: 'string',
              pattern: '^\\+?[\\d\\s\\-\\(\\)]+$',
              description: 'Optional phone number for verification',
              nullable: true
            }
          },
          required: ['duprId']
        },
        DuprValidationResponse: {
          type: 'object',
          properties: {
            isValid: {
              type: 'boolean',
              description: 'Whether the DUPR ID is valid'
            },
            player: {
              $ref: '#/components/schemas/DuprPlayer',
              description: 'Player data if validation successful',
              nullable: true
            },
            error: {
              type: 'string',
              description: 'Error message if validation failed',
              nullable: true
            }
          },
          required: ['isValid']
        },
        DuprRatingResponse: {
          type: 'object',
          properties: {
            duprId: {
              type: 'string',
              description: 'DUPR player ID'
            },
            singlesRating: {
              type: 'number',
              format: 'float',
              minimum: 2.000,
              maximum: 8.000,
              description: 'DUPR singles rating',
              nullable: true
            },
            doublesRating: {
              type: 'number',
              format: 'float',
              minimum: 2.000,
              maximum: 8.000,
              description: 'DUPR doubles rating',
              nullable: true
            },
            reliability: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              description: 'DUPR reliability score (1-100%)',
              nullable: true
            },
            lastUpdated: {
              type: 'string',
              format: 'date-time',
              description: 'Last time rating was updated'
            }
          },
          required: ['duprId', 'lastUpdated']
        },
        HealthCheckResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy'],
              description: 'Service health status'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Health check timestamp'
            }
          },
          required: ['status', 'timestamp']
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              enum: [false]
            },
            error: {
              type: 'string',
              description: 'Error message'
            },
            message: {
              type: 'string',
              description: 'Human-readable error description'
            }
          },
          required: ['success', 'error', 'message']
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad request - validation error or missing parameters',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              examples: {
                validationError: {
                  summary: 'Validation error',
                  value: {
                    success: false,
                    error: 'Validation error: duprId is required',
                    message: 'Failed to validate player'
                  }
                }
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              examples: {
                playerNotFound: {
                  summary: 'Player not found',
                  value: {
                    success: false,
                    error: 'Player not found in DUPR database',
                    message: 'Player validation failed'
                  }
                }
              }
            }
          }
        },
        Unauthorized: {
          description: 'Authentication failed with DUPR API',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              examples: {
                authError: {
                  summary: 'Authentication error',
                  value: {
                    success: false,
                    error: 'Authentication failed with DUPR API',
                    message: 'Failed to validate player'
                  }
                }
              }
            }
          }
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              examples: {
                rateLimit: {
                  summary: 'Rate limit exceeded',
                  value: {
                    success: false,
                    error: 'Too many requests',
                    message: 'Rate limit exceeded. Please try again later.'
                  }
                }
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              examples: {
                serverError: {
                  summary: 'Server error',
                  value: {
                    success: false,
                    error: 'Internal server error',
                    message: 'An unexpected error occurred'
                  }
                }
              }
            }
          }
        }
      },
      parameters: {
        DuprId: {
          name: 'duprId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            minLength: 1,
            maxLength: 50
          },
          description: 'DUPR player ID'
        },
        SearchQuery: {
          name: 'q',
          in: 'query',
          required: true,
          schema: {
            type: 'string',
            minLength: 1
          },
          description: 'Search query (name, email, etc.)'
        }
      }
    }
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};

export const specs = swaggerJsdoc(options);