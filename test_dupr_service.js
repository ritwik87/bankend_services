const axios = require('axios');

const DUPR_SERVICE_URL = 'http://localhost:3001/api/dupr';

async function testDuprService() {
  console.log('🧪 Testing DUPR Service...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${DUPR_SERVICE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.message);
    console.log('');

    // Test 2: Validate Player (this will fail without real credentials, but tests the endpoint)
    console.log('2. Testing player validation endpoint...');
    try {
      const validationResponse = await axios.post(`${DUPR_SERVICE_URL}/validate`, {
        duprId: 'test-dupr-id',
        email: 'test@example.com'
      });
      console.log('✅ Validation endpoint working:', validationResponse.data);
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 401) {
        console.log('⚠️ Validation endpoint reachable (expected auth/validation error)');
        console.log('   Error:', error.response.data.message);
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 3: Rating Endpoint
    console.log('3. Testing rating endpoint...');
    try {
      const ratingResponse = await axios.get(`${DUPR_SERVICE_URL}/rating/test-dupr-id`);
      console.log('✅ Rating endpoint working:', ratingResponse.data);
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 401) {
        console.log('⚠️ Rating endpoint reachable (expected auth/not found error)');
        console.log('   Error:', error.response.data.message);
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 4: Lookup Endpoint
    console.log('4. Testing lookup endpoint...');
    try {
      const lookupResponse = await axios.get(`${DUPR_SERVICE_URL}/lookup?email=test@example.com`);
      console.log('✅ Lookup endpoint working:', lookupResponse.data);
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 401) {
        console.log('⚠️ Lookup endpoint reachable (expected not found/auth error)');
        console.log('   Error:', error.response.data.message);
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 5: Search Endpoint
    console.log('5. Testing search endpoint...');
    try {
      const searchResponse = await axios.get(`${DUPR_SERVICE_URL}/search?q=test`);
      console.log('✅ Search endpoint working:', searchResponse.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️ Search endpoint reachable (expected auth error)');
        console.log('   Error:', error.response.data.message);
      } else {
        throw error;
      }
    }
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('');
    console.log('📝 Notes:');
    console.log('   - Health check should pass completely');
    console.log('   - Other endpoints may show auth errors until DUPR credentials are configured');
    console.log('   - Configure DUPR_CLIENT_KEY and DUPR_CLIENT_SECRET in .env to test with real data');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the DUPR service is running:');
      console.log('   cd dupr-service');
      console.log('   npm run dev');
    }
  }
}

// Run tests
testDuprService();