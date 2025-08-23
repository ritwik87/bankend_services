// Example requests and responses for DUPR Service API

export const exampleRequests = {
  validatePlayer: {
    basic: {
      duprId: "4581541063"
    },
    withEmail: {
      duprId: "4581541063", 
      email: "player@example.com"
    },
    withPhone: {
      duprId: "4581541063",
      phone: "+1-555-0123"
    },
    complete: {
      duprId: "4581541063",
      email: "player@example.com", 
      phone: "+1-555-0123"
    }
  }
};

export const exampleResponses = {
  validationSuccess: {
    success: true,
    data: {
      isValid: true,
      player: {
        id: "4581541063",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "+1-555-0123",
        duprId: "4581541063",
        singlesRating: 4.250,
        doublesRating: 4.150,
        reliability: 85,
        isActive: true,
        createdAt: "2023-01-15T10:30:00Z",
        updatedAt: "2024-01-20T14:22:00Z"
      }
    },
    message: "Player validated successfully"
  },
  
  validationFailed: {
    success: false,
    data: {
      isValid: false,
      error: "Player not found in DUPR database"
    },
    message: "Player validation failed"
  },
  
  ratingSuccess: {
    success: true,
    data: {
      duprId: "4581541063",
      singlesRating: 4.250,
      doublesRating: 4.150,
      reliability: 85,
      lastUpdated: "2024-01-20T14:22:00Z"
    },
    message: "Player rating retrieved successfully"
  },
  
  searchResults: {
    success: true,
    data: [
      {
        id: "4581541063",
        firstName: "John",
        lastName: "Doe",
        duprId: "4581541063",
        singlesRating: 4.250,
        doublesRating: 4.150,
        reliability: 85,
        isActive: true,
        createdAt: "2023-01-15T10:30:00Z",
        updatedAt: "2024-01-20T14:22:00Z"
      }
    ],
    message: "Found 1 players"
  },
  
  healthCheck: {
    success: true,
    data: {
      status: "healthy",
      timestamp: "2024-01-20T14:22:00Z"
    },
    message: "DUPR service is healthy"
  },
  
  errors: {
    badRequest: {
      success: false,
      error: "Validation error: duprId is required",
      message: "Failed to validate player"
    },
    
    notFound: {
      success: false,
      error: "Player not found in DUPR database", 
      message: "Player validation failed"
    },
    
    unauthorized: {
      success: false,
      error: "Authentication failed with DUPR API",
      message: "Failed to validate player"
    },
    
    rateLimit: {
      success: false,
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later."
    },
    
    serverError: {
      success: false,
      error: "Internal server error",
      message: "An unexpected error occurred"
    }
  }
};