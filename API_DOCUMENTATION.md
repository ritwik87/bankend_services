# DUPR Service API Documentation

## Overview

The DUPR Service API provides integration with the Dynamic Universal Pickleball Rating (DUPR) system for validating player IDs and retrieving current ratings. This service acts as a middleware between your tournament management application and the official DUPR API.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://api.tournament-management.com` (replace with your domain)

## Interactive Documentation

Access the interactive Swagger documentation at:
- **Swagger UI**: `{BASE_URL}/docs`
- **OpenAPI JSON**: `{BASE_URL}/docs/json`

## Authentication

The DUPR Service handles authentication with the DUPR API internally using client credentials. No authentication is required for API consumers, but rate limiting is applied.

## Rate Limiting

- **Window**: 15 minutes (configurable)
- **Max Requests**: 100 per window (configurable)
- **Headers**: Standard rate limiting headers are included in responses

## Endpoints

### 1. Validate DUPR Player ID

**POST** `/api/dupr/validate`

Validates a DUPR player ID with optional email/phone verification.

#### Request Body
```json
{
  "duprId": "4581541063",
  "email": "player@example.com",     // Optional
  "phone": "+1-555-0123"            // Optional
}
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "player": {
      "id": "4581541063",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+1-555-0123",
      "duprId": "4581541063",
      "singlesRating": 4.250,
      "doublesRating": 4.150,
      "reliability": 85,
      "isActive": true,
      "createdAt": "2023-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:22:00Z"
    }
  },
  "message": "Player validated successfully"
}
```

#### Error Response (400)
```json
{
  "success": false,
  "data": {
    "isValid": false,
    "error": "Player not found in DUPR database"
  },
  "message": "Player validation failed"
}
```

---

### 2. Get DUPR Rating

**GET** `/api/dupr/rating/{duprId}`

Retrieves current DUPR ratings for a specific player.

#### Path Parameters
- `duprId` (string): DUPR player ID

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "duprId": "4581541063",
    "singlesRating": 4.250,
    "doublesRating": 4.150,
    "reliability": 85,
    "lastUpdated": "2024-01-20T14:22:00Z"
  },
  "message": "Player rating retrieved successfully"
}
```

---

### 3. Search DUPR Players

**GET** `/api/dupr/search`

Search for players in the DUPR database.

#### Query Parameters
- `q` (string): Search query (name, email, etc.)

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "id": "4581541063",
      "firstName": "John",
      "lastName": "Doe",
      "duprId": "4581541063",
      "singlesRating": 4.250,
      "doublesRating": 4.150,
      "reliability": 85,
      "isActive": true,
      "createdAt": "2023-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:22:00Z"
    }
  ],
  "message": "Found 1 players"
}
```

---

### 4. Health Check

**GET** `/api/dupr/health`

Check service health status.

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-20T14:22:00Z"
  },
  "message": "DUPR service is healthy"
}
```

## Data Models

### DUPR Player
```typescript
interface DuprPlayer {
  id: string;                    // Player ID
  firstName: string;             // First name
  lastName: string;              // Last name
  email?: string;                // Email address (optional)
  phone?: string;                // Phone number (optional)
  duprId: string;               // DUPR ID (same as id)
  singlesRating?: number;       // Singles rating (2.000-8.000)
  doublesRating?: number;       // Doubles rating (2.000-8.000)
  reliability?: number;         // Reliability score (1-100%)
  isActive: boolean;            // Account status
  createdAt: string;            // ISO timestamp
  updatedAt: string;            // ISO timestamp
}
```

### DUPR Rating Levels
- **2.000 - 2.999**: New Player
- **3.000 - 4.499**: Beginner  
- **4.500 - 5.999**: Intermediate
- **6.000 - 8.000**: Advanced

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Human-readable message"
}
```

### Common Error Codes
- **400**: Bad Request - Invalid input or validation error
- **401**: Unauthorized - DUPR API authentication failed
- **404**: Not Found - Player not found in DUPR database
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Internal Server Error - Unexpected server error
- **503**: Service Unavailable - Health check failed

## Rate Limiting Headers

Rate limiting information is provided in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95  
X-RateLimit-Reset: 1640995200
```

## Usage Examples

### JavaScript/TypeScript
```javascript
// Validate player
const validatePlayer = async (duprId, email) => {
  const response = await fetch('http://localhost:3001/api/dupr/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duprId, email })
  });
  
  const result = await response.json();
  return result;
};

// Get rating
const getRating = async (duprId) => {
  const response = await fetch(`http://localhost:3001/api/dupr/rating/${duprId}`);
  const result = await response.json();
  return result;
};
```

### cURL
```bash
# Validate player
curl -X POST http://localhost:3001/api/dupr/validate \
  -H "Content-Type: application/json" \
  -d '{"duprId": "4581541063", "email": "player@example.com"}'

# Get rating
curl http://localhost:3001/api/dupr/rating/4581541063

# Search players
curl "http://localhost:3001/api/dupr/search?q=John%20Doe"

# Health check
curl http://localhost:3001/api/dupr/health
```

## Environment Configuration

The service requires the following environment variables:

```env
# Server
PORT=3001
NODE_ENV=development

# DUPR API
DUPR_API_BASE_URL=https://uat.mydupr.com/api
DUPR_CLIENT_KEY=your_client_key
DUPR_CLIENT_SECRET=your_client_secret

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Development

### Running the Service
```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test
```

### Testing Endpoints
```bash
# Run included test script
node test_dupr_service.js
```

## Support

For issues or questions:
- Check the interactive documentation at `/docs`
- Review the health check endpoint at `/api/dupr/health`
- Consult the logs in the `logs/` directory
- Contact: support@tournament-management.com

## Changelog

### v1.0.0
- Initial release
- Player validation with email/phone verification
- Rating retrieval
- Player search functionality
- Health monitoring
- Rate limiting
- Comprehensive error handling
- Swagger documentation