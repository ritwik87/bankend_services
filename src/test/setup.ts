// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods in test environment
const originalConsole = console;

beforeAll(() => {
  // Only suppress logs in non-verbose test runs
  if (!process.env.VERBOSE_TESTS) {
    global.console = {
      ...originalConsole,
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      // Keep error for debugging
      error: originalConsole.error,
      debug: jest.fn()
    };
  }
});

afterAll(() => {
  // Restore original console
  global.console = originalConsole;
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDuprId(): R;
      toBeValidRating(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidDuprId(received: string) {
    const isValid = typeof received === 'string' && received.length > 0;
    
    if (isValid) {
      return {
        message: () => `Expected ${received} not to be a valid DUPR ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid DUPR ID`,
        pass: false,
      };
    }
  },
  
  toBeValidRating(received: number) {
    const isValid = typeof received === 'number' && received >= 2.000 && received <= 8.000;
    
    if (isValid) {
      return {
        message: () => `Expected ${received} not to be a valid DUPR rating`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid DUPR rating (2.000-8.000)`,
        pass: false,
      };
    }
  }
});

// Mock external dependencies for testing
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));