# DUPR Service API - Swagger Documentation Integration

## 📚 Interactive Documentation

The DUPR Service now includes comprehensive Swagger/OpenAPI documentation for easy API exploration and testing.

## 🔗 Access Points

When the service is running, access the documentation at:

- **Swagger UI (Interactive)**: `http://localhost:3001/docs`
- **OpenAPI JSON Spec**: `http://localhost:3001/docs/json`
- **Service Info**: `http://localhost:3001/`

## ✨ Features

### 🎯 **Comprehensive API Documentation**
- All endpoints documented with detailed descriptions
- Request/response schemas with examples
- Parameter validation rules
- Error response examples
- Rate limiting information

### 🧪 **Interactive Testing**
- Test endpoints directly from the browser
- Pre-filled example requests
- Real-time response viewing
- Authentication handled automatically

### 📋 **Rich Schema Documentation**
- Complete TypeScript interfaces
- Data validation rules
- Field descriptions and constraints
- Response format specifications

## 📖 Documentation Structure

### **API Endpoints**

1. **DUPR Validation** (`POST /api/dupr/validate`)
   - Validate DUPR player IDs
   - Optional email/phone verification
   - Complete player data response

2. **DUPR Ratings** (`GET /api/dupr/rating/{duprId}`)
   - Retrieve current ratings
   - Singles and doubles ratings
   - Reliability scores

3. **DUPR Search** (`GET /api/dupr/search`)
   - Search players by name/email
   - Paginated results
   - Flexible query parameters

4. **Health Check** (`GET /api/dupr/health`)
   - Service status monitoring
   - Timestamp information
   - System health indicators

### **Response Examples**

Each endpoint includes multiple examples:
- **Success scenarios** with sample data
- **Error scenarios** with proper error codes
- **Edge cases** and validation failures
- **Different input variations**

## 🚀 Usage Guide

### **1. Explore the API**
1. Start the DUPR service: `npm run dev`
2. Open browser to: `http://localhost:3001/docs`
3. Browse through available endpoints
4. Review request/response schemas

### **2. Test Endpoints**
1. Click on any endpoint to expand
2. Click "Try it out" button
3. Fill in parameters or use provided examples
4. Click "Execute" to send request
5. View the response in real-time

### **3. Copy Request Examples**
```bash
# The documentation provides ready-to-use cURL commands
curl -X POST "http://localhost:3001/api/dupr/validate" \
  -H "Content-Type: application/json" \
  -d '{"duprId": "4581541063", "email": "player@example.com"}'
```

### **4. Generate Client Code**
The OpenAPI spec can be used with code generators:
```bash
# Generate TypeScript client
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3001/docs/json \
  -g typescript-axios \
  -o ./dupr-client
```

## 🎨 Customization

The Swagger UI includes custom styling:
- Tournament-focused green theme
- Clean, professional appearance
- Responsive design
- Consistent with DUPR branding

## 📱 Mobile-Friendly

The documentation is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile devices
- API testing tools

## 🔍 Schema Validation

All request/response data includes:
- **Type validation** (string, number, boolean)
- **Format validation** (email, date-time, phone)
- **Range validation** (min/max values)
- **Required field validation**
- **Pattern matching** (regex)

## 🌐 Integration Examples

### **Frontend Integration**
```typescript
// Generated TypeScript interfaces available
interface DuprValidationRequest {
  duprId: string;
  email?: string;
  phone?: string;
}

// API client automatically typed
const api = new DuprServiceApi('http://localhost:3001');
const result = await api.validatePlayer(request);
```

### **Backend Integration**
```javascript
// Node.js example with proper error handling
const response = await fetch('http://localhost:3001/api/dupr/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    duprId: '4581541063', 
    email: 'player@example.com' 
  })
});

const data = await response.json();
if (data.success) {
  console.log('Player validated:', data.data.player);
} else {
  console.error('Validation failed:', data.error);
}
```

## 🔧 Development Features

### **Auto-Generated Documentation**
- Updates automatically with code changes
- Consistent with actual API behavior
- Version controlled with source code

### **Development-Friendly**
- Hot-reload during development
- Detailed error messages
- Request/response logging
- Performance metrics

## 🚀 Deployment Notes

### **Production Setup**
1. Update server URLs in swagger config
2. Configure proper CORS origins
3. Set up reverse proxy if needed
4. Enable HTTPS for security

### **Documentation Hosting**
The documentation can be:
- Served directly from the API service
- Hosted separately for better performance
- Integrated into existing documentation sites
- Used for API client generation

## 📋 Quick Start Checklist

- [x] Service running on port 3001
- [x] Swagger UI accessible at `/docs`
- [x] OpenAPI JSON at `/docs/json`
- [x] All endpoints documented
- [x] Examples provided
- [x] Error responses covered
- [x] Schema validation included
- [x] Interactive testing enabled

## 🎯 Benefits

1. **Developer Experience**: Easy API exploration and testing
2. **Documentation Accuracy**: Auto-generated from code
3. **Client Generation**: Support for multiple languages
4. **Testing**: Built-in API testing capabilities
5. **Onboarding**: Self-service API documentation
6. **Standards Compliance**: OpenAPI 3.0 specification
7. **Integration Ready**: Export for external tools

## 📞 Support

For documentation issues:
- Check the interactive examples at `/docs`
- Review the OpenAPI spec at `/docs/json`
- Test endpoints using the built-in testing tools
- Refer to the detailed error examples

The Swagger documentation provides everything needed to integrate with the DUPR Service API effectively!