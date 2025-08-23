# DUPR Integration Setup Guide

This guide will help you set up the DUPR API integration for validating player IDs and retrieving ratings in your tournament management system.

## Overview

The DUPR integration consists of:
1. **DUPR Service**: Separate Node.js/Express API service (`dupr-service/`)
2. **Database Updates**: Additional fields in the profiles table for DUPR ratings
3. **Frontend Integration**: React components and hooks for DUPR functionality
4. **API Integration**: Service layer to communicate with DUPR API

## Prerequisites

- Node.js 18+ installed
- Existing tournament management system running
- DUPR API credentials (client key and secret)
- Supabase database access

## Step 1: Database Migration

Run the database migration to add DUPR rating fields:

```sql
-- Run this in your Supabase SQL editor
-- File: dupr_rating_migration.sql

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS dupr_singles_rating DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS dupr_doubles_rating DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS dupr_reliability INTEGER,
ADD COLUMN IF NOT EXISTS dupr_last_updated TIMESTAMP WITH TIME ZONE;
```

## Step 2: DUPR Service Setup

1. **Install Dependencies**
   ```bash
   cd dupr-service
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your DUPR credentials:
   ```env
   DUPR_API_BASE_URL=https://uat.mydupr.com/api
   DUPR_CLIENT_KEY=your_dupr_client_key
   DUPR_CLIENT_SECRET=your_dupr_client_secret
   PORT=3001
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
   ```

3. **Start the Service**
   ```bash
   # Development
   npm run dev

   # Production
   npm run build
   npm start
   ```

## Step 3: Main App Configuration

1. **Environment Variables**
   Add to your main app's `.env`:
   ```env
   REACT_APP_DUPR_SERVICE_URL=http://localhost:3001/api/dupr
   ```

2. **Update Supabase Types**
   The TypeScript types have been updated automatically in `src/types/supabase.ts`

## Step 4: Frontend Integration

### Using the DUPR Profile Card Component

```tsx
import DuprProfileCard from '@/components/dupr/DuprProfileCard';

// In your profile page or component
<DuprProfileCard 
  showEditForm={true}
  onProfileUpdate={() => {
    // Refresh profile data
    console.log('DUPR profile updated');
  }}
/>
```

### Using the DUPR Hook

```tsx
import { useDupr } from '@/hooks/useDupr';

function MyComponent() {
  const { 
    validateDuprId, 
    getDuprRating, 
    validateAndUpdateProfile,
    formatRating,
    getRatingLevel 
  } = useDupr();

  const handleValidation = async () => {
    const result = await validateDuprId('some-dupr-id', 'email@example.com');
    if (result.isValid) {
      console.log('Player validated:', result.player);
    }
  };
}
```

### Integration Service Usage

```tsx
import duprIntegrationService from '@/services/duprIntegration';

// Validate DUPR ID
const validation = await duprIntegrationService.validateDuprId('dupr-id');

// Get rating data
const rating = await duprIntegrationService.getDuprRating('dupr-id');

// Update user profile with DUPR data
const success = await duprIntegrationService.validateAndUpdateDuprRating(
  userId, 
  'dupr-id', 
  'email@example.com'
);
```

## Step 5: Testing

### Test DUPR Service Endpoints

```bash
# Health check
curl http://localhost:3001/api/dupr/health

# Validate player (requires DUPR credentials)
curl -X POST http://localhost:3001/api/dupr/validate \
  -H "Content-Type: application/json" \
  -d '{"duprId": "test-id", "email": "test@example.com"}'

# Get player rating
curl http://localhost:3001/api/dupr/rating/test-dupr-id
```

### Test Frontend Integration

1. Navigate to a profile page
2. Add the DuprProfileCard component
3. Test DUPR ID validation
4. Verify ratings are displayed correctly

## API Endpoints

### DUPR Service Endpoints

- `POST /api/dupr/validate` - Validate DUPR ID with optional email/phone
- `GET /api/dupr/rating/:duprId` - Get DUPR rating for a player
- `GET /api/dupr/search?q=query` - Search for DUPR players
- `GET /api/dupr/health` - Health check

### Request/Response Examples

**Validate Player:**
```json
// POST /api/dupr/validate
{
  "duprId": "player-123",
  "email": "player@example.com"
}

// Response
{
  "success": true,
  "data": {
    "isValid": true,
    "player": {
      "duprId": "player-123",
      "firstName": "John",
      "lastName": "Doe",
      "singlesRating": 4.25,
      "doublesRating": 4.15,
      "reliability": 85
    }
  }
}
```

## Database Schema

New columns added to `profiles` table:

| Column | Type | Description |
|--------|------|-------------|
| `dupr_singles_rating` | DECIMAL(4,3) | DUPR singles rating (2.000-8.000) |
| `dupr_doubles_rating` | DECIMAL(4,3) | DUPR doubles rating (2.000-8.000) |
| `dupr_reliability` | INTEGER | DUPR reliability score (1-100%) |
| `dupr_last_updated` | TIMESTAMP | Last sync timestamp |

## Security Considerations

1. **Rate Limiting**: DUPR service includes built-in rate limiting
2. **CORS**: Configure allowed origins in environment variables
3. **API Keys**: Store DUPR credentials securely
4. **Input Validation**: All inputs are validated using Joi schemas
5. **Error Handling**: Comprehensive error handling with logging

## Production Deployment

1. **DUPR Service Deployment**
   ```bash
   # Build the service
   cd dupr-service
   npm run build
   
   # Set production environment
   NODE_ENV=production
   
   # Use PM2 for process management
   npm install -g pm2
   pm2 start dist/index.js --name dupr-service
   ```

2. **Environment Variables**
   - Update `DUPR_API_BASE_URL` to production endpoint
   - Set proper `ALLOWED_ORIGINS` for your domain
   - Use production DUPR credentials

3. **Reverse Proxy**
   Configure nginx or similar to proxy requests to the DUPR service

## Troubleshooting

### Common Issues

1. **DUPR Authentication Failed**
   - Verify client key and secret are correct
   - Check if credentials are for correct environment (UAT vs Production)

2. **CORS Errors**
   - Update `ALLOWED_ORIGINS` in DUPR service environment
   - Ensure frontend URL matches allowed origins

3. **Database Migration Issues**
   - Run migration script in Supabase SQL editor
   - Check if columns already exist before adding

4. **Service Connection Issues**
   - Verify DUPR service is running on correct port
   - Check `REACT_APP_DUPR_SERVICE_URL` in frontend environment

### Debugging

Check logs in `dupr-service/logs/` directory for detailed error information.

## Features Implemented

- ✅ DUPR ID validation with email/phone verification
- ✅ Rating retrieval and display
- ✅ Automatic profile updates
- ✅ Rating synchronization
- ✅ Responsive UI components
- ✅ Error handling and loading states
- ✅ TypeScript type safety
- ✅ Rate limiting and security
- ✅ Comprehensive logging

## Next Steps

1. Obtain DUPR API credentials from DUPR Account Manager
2. Run database migration
3. Start DUPR service with your credentials
4. Test integration with real DUPR IDs
5. Deploy to production environment