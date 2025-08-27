# DUPR Service - CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the dupr-service backend.

## Context Session Management

### IMPORTANT: Always maintain context session files for continuity

Before starting any development work on dupr-service:
1. **Read the current context session file**: `dupr-service/context_session_1.md`
2. **Read main project context**: Also read `../context_session_1.md` for frontend integration context

After making any changes to the dupr-service codebase:
1. **Update dupr-service context**: Update `dupr-service/context_session_1.md` with:
   - New API endpoints added/modified
   - Service layer changes
   - Database operations updates
   - Authentication/security changes
   - Integration updates with frontend
   - Build and compilation status

2. **Update main project context**: If changes affect frontend integration, also update `../context_session_1.md`

### Context File Structure for dupr-service
Each context session file should contain:
- **Session Summary**: Backend changes accomplished
- **API Endpoints**: New/modified routes with examples
- **Service Changes**: Business logic updates
- **Database Operations**: Schema or query changes
- **Security Updates**: Auth, validation, rate limiting changes
- **Integration Notes**: How changes affect frontend
- **Build Status**: TypeScript compilation status
- **Environment**: Required environment variables
- **Next Steps**: Future backend enhancements

## Development Commands

```bash
# Start development server
npm run dev

# Start with debugging
npm run dev:debug

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Check TypeScript compilation
npx tsc --noEmit

# Build and watch TypeScript
npm run build:watch

# Start production server
npm start

# Open API documentation
npm run docs:open
```

## Project Structure

This is a Node.js Express backend service providing:
- DUPR API integration and validation
- User management operations
- Authentication services
- Rate limiting and security middleware

## Environment Setup

Required environment variables:
```env
DUPR_API_VERSION=v1.0
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Documentation

When service is running, Swagger documentation is available at:
`http://localhost:3001/docs`

## Integration with Main Project

This service integrates with the main tournament management system via:
- RTK Query APIs in the frontend
- Shared TypeScript interfaces
- CORS configuration for local development
- Rate limiting for API protection

Always consider frontend impact when making backend changes and update both context files accordingly.