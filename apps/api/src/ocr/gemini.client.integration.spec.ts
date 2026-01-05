/**
 * Gemini Client Integration Tests
 *
 * These tests require a valid GEMINI_API_KEY environment variable.
 * They are skipped by default in CI and should be run manually for E2E validation.
 *
 * To run these tests:
 * 1. Set GEMINI_API_KEY in your environment
 * 2. Run: npm test -- --testPathPattern="gemini.client.integration" --testTimeout=60000
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiClient } from './gemini.client';

// Skip integration tests in CI or when API key is not available
const SKIP_INTEGRATION_TESTS =
  !process.env.GEMINI_API_KEY || process.env.CI === 'true';

// Conditionally skip the entire test suite
const describeOrSkip = SKIP_INTEGRATION_TESTS ? describe.skip : describe;

describeOrSkip('GeminiClient Integration Tests', () => {
  let client: GeminiClient;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'GEMINI_API_KEY') return process.env.GEMINI_API_KEY;
              if (key === 'GEMINI_MODEL') return 'gemini-3.0-flash';
              if (key === 'GEMINI_TIMEOUT_MS') return 30000;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    client = module.get<GeminiClient>(GeminiClient);
  });

  describe('processWithVision - Real API', () => {
    it(
      'should process a real image file with Gemini API',
      async () => {
        // Create a simple test image (1x1 white pixel PNG)
        const testImageBase64 =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        const testImageBuffer = Buffer.from(testImageBase64, 'base64');

        const result = await client.processWithVision(
          testImageBuffer,
          'image/png',
          50.0, // Low confidence to simulate fallback scenario
        );

        expect(result.success).toBe(true);
        expect(result.engine).toBe('GEMINI');
        expect(result.model_version).toBe('gemini-3.0-flash');
        expect(result.processing_time_ms).toBeGreaterThan(0);
        // Note: A 1x1 white image won't have text, but API should still respond
      },
      60000, // 60 second timeout for API call
    );
  });

  describe('configuration validation', () => {
    it('should correctly report configuration status', () => {
      expect(client.isConfigured()).toBe(true);
    });

    it('should validate supported MIME types', () => {
      expect(client.isSupportedMimeType('image/png')).toBe(true);
      expect(client.isSupportedMimeType('image/jpeg')).toBe(true);
      expect(client.isSupportedMimeType('application/pdf')).toBe(true);
      expect(client.isSupportedMimeType('image/gif')).toBe(false);
    });
  });
});

// Always-run test to verify the skip logic works
describe('GeminiClient Integration Tests - Skip Check', () => {
  it('should skip integration tests when GEMINI_API_KEY is not set or in CI', () => {
    if (SKIP_INTEGRATION_TESTS) {
      // This test always passes - it just documents that integration tests are skipped
      expect(true).toBe(true);
    } else {
      // If we get here, API key is set and not in CI
      expect(process.env.GEMINI_API_KEY).toBeTruthy();
    }
  });
});
