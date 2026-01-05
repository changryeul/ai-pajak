import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiClient, GeminiOcrResponse } from './gemini.client';
import { GeminiFallbackException } from './exceptions';

// Mock @google/genai
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

describe('GeminiClient', () => {
  let client: GeminiClient;
  let configService: ConfigService;

  const mockGeminiResponse = {
    candidates: [
      {
        content: {
          parts: [{ text: 'Extracted text line 1\nExtracted text line 2' }],
        },
      },
    ],
  };

  const expectedOcrResponse: GeminiOcrResponse = {
    success: true,
    processing_time_ms: expect.any(Number),
    results: [
      { text: 'Extracted text line 1', confidence: null, bbox: [], page: 1 },
      { text: 'Extracted text line 2', confidence: null, bbox: [], page: 1 },
    ],
    engine: 'GEMINI',
    model_version: 'gemini-3.0-flash',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'GEMINI_API_KEY') return 'test-api-key';
              if (key === 'GEMINI_MODEL') return 'gemini-3.0-flash';
              if (key === 'GEMINI_TIMEOUT_MS') return 30000;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    client = module.get<GeminiClient>(GeminiClient);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('processWithVision', () => {
    it('should successfully process an image and return OCR results', async () => {
      mockGenerateContent.mockResolvedValueOnce(mockGeminiResponse);

      const file = Buffer.from('test image data');
      const result = await client.processWithVision(file, 'image/png', 75.5);

      expect(result.success).toBe(true);
      expect(result.engine).toBe('GEMINI');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].confidence).toBeNull(); // Gemini doesn't provide confidence
      expect(result.results[0].bbox).toEqual([]); // Gemini doesn't provide bounding boxes
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should include original PaddleOCR confidence in logs', async () => {
      const logSpy = jest.spyOn((client as any).logger, 'log');
      mockGenerateContent.mockResolvedValueOnce(mockGeminiResponse);

      const file = Buffer.from('test image data');
      await client.processWithVision(file, 'image/png', 75.5);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('75.50%'),
      );
    });

    it('should retry on failure with exponential backoff (1s, 2s, 4s)', async () => {
      // First two calls fail, third succeeds
      mockGenerateContent
        .mockRejectedValueOnce(new Error('API Error 1'))
        .mockRejectedValueOnce(new Error('API Error 2'))
        .mockResolvedValueOnce(mockGeminiResponse);

      const file = Buffer.from('test image data');
      const processPromise = client.processWithVision(file, 'image/png', 75.5);

      // First backoff: 1 second
      await jest.advanceTimersByTimeAsync(1000);
      // Second backoff: 2 seconds
      await jest.advanceTimersByTimeAsync(2000);

      const result = await processPromise;

      expect(result.success).toBe(true);
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should throw GeminiFallbackException after 3 retries', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Persistent API Error'));

      const file = Buffer.from('test image data');

      let caughtError: Error | undefined;
      const processPromise = client.processWithVision(file, 'image/png', 75.5).catch((e) => {
        caughtError = e;
      });

      // Advance through all backoff delays
      await jest.advanceTimersByTimeAsync(10000);
      await processPromise;

      expect(caughtError).toBeInstanceOf(GeminiFallbackException);
      expect((caughtError as GeminiFallbackException).originalPaddleConfidence).toBe(75.5);
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should throw GeminiFallbackException on timeout', async () => {
      // Mock a slow response that times out
      mockGenerateContent.mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 60000)),
      );

      const file = Buffer.from('test image data');

      let caughtError: Error | undefined;
      const processPromise = client.processWithVision(file, 'image/png', 75.5).catch((e) => {
        caughtError = e;
      });

      // Advance past timeout (30s) and all retries
      await jest.advanceTimersByTimeAsync(120000);
      await processPromise;

      expect(caughtError).toBeInstanceOf(GeminiFallbackException);
      expect(caughtError?.message).toContain('failed after 3 attempts');
    });
  });

  describe('isConfigured', () => {
    it('should return true when API key is configured', () => {
      expect(client.isConfigured()).toBe(true);
    });

    it('should return false when API key is not configured', async () => {
      const moduleWithoutKey = await Test.createTestingModule({
        providers: [
          GeminiClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: unknown) => {
                if (key === 'GEMINI_API_KEY') return undefined;
                if (key === 'GEMINI_MODEL') return 'gemini-3.0-flash';
                if (key === 'GEMINI_TIMEOUT_MS') return 30000;
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const clientWithoutKey = moduleWithoutKey.get<GeminiClient>(GeminiClient);
      expect(clientWithoutKey.isConfigured()).toBe(false);
    });
  });

  describe('isSupportedMimeType', () => {
    it('should return true for supported MIME types', () => {
      expect(client.isSupportedMimeType('image/jpeg')).toBe(true);
      expect(client.isSupportedMimeType('image/png')).toBe(true);
      expect(client.isSupportedMimeType('application/pdf')).toBe(true);
    });

    it('should return false for unsupported MIME types', () => {
      expect(client.isSupportedMimeType('image/gif')).toBe(false);
      expect(client.isSupportedMimeType('text/plain')).toBe(false);
      expect(client.isSupportedMimeType('application/json')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw GeminiFallbackException when API key is not configured', async () => {
      const moduleWithoutKey = await Test.createTestingModule({
        providers: [
          GeminiClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: unknown) => {
                if (key === 'GEMINI_API_KEY') return undefined;
                if (key === 'GEMINI_MODEL') return 'gemini-3.0-flash';
                if (key === 'GEMINI_TIMEOUT_MS') return 30000;
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const clientWithoutKey = moduleWithoutKey.get<GeminiClient>(GeminiClient);
      const file = Buffer.from('test image data');

      await expect(
        clientWithoutKey.processWithVision(file, 'image/png', 75.5),
      ).rejects.toThrow(GeminiFallbackException);
    });

    it('should throw GeminiFallbackException for unsupported MIME type', async () => {
      const file = Buffer.from('test image data');

      await expect(
        client.processWithVision(file, 'image/gif', 75.5),
      ).rejects.toThrow(GeminiFallbackException);
    });
  });

  describe('response parsing', () => {
    it('should handle empty response from Gemini', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [{ content: { parts: [] } }],
      });

      const file = Buffer.from('test image data');
      const result = await client.processWithVision(file, 'image/png', 75.5);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
    });

    it('should handle multi-part response from Gemini', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [
                { text: 'Part 1 text' },
                { text: 'Part 2 text' },
              ],
            },
          },
        ],
      });

      const file = Buffer.from('test image data');
      const result = await client.processWithVision(file, 'image/png', 75.5);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].text).toBe('Part 1 text');
      expect(result.results[1].text).toBe('Part 2 text');
    });

    it('should filter out empty lines from response', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [{ text: 'Line 1\n\n\nLine 2\n  \nLine 3' }],
            },
          },
        ],
      });

      const file = Buffer.from('test image data');
      const result = await client.processWithVision(file, 'image/png', 75.5);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results.map((r) => r.text)).toEqual([
        'Line 1',
        'Line 2',
        'Line 3',
      ]);
    });
  });

  describe('configuration', () => {
    it('should use environment variables for configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('GEMINI_API_KEY');
      expect(configService.get).toHaveBeenCalledWith(
        'GEMINI_MODEL',
        'gemini-3.0-flash',
      );
      expect(configService.get).toHaveBeenCalledWith('GEMINI_TIMEOUT_MS', 30000);
    });
  });

  describe('rotated text warning (AC #6)', () => {
    it('should log warning about rotated text limitation when processing image', async () => {
      const warnSpy = jest.spyOn((client as any).logger, 'warn');
      mockGenerateContent.mockResolvedValueOnce(mockGeminiResponse);

      const file = Buffer.from('test image data');
      await client.processWithVision(file, 'image/png', 75.5);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Known Limitation]'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('rotated text'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('90°/180°/270°'),
      );
    });

    it('should log warning about rotated text limitation when processing PDF', async () => {
      const warnSpy = jest.spyOn((client as any).logger, 'warn');
      mockGenerateContent.mockResolvedValueOnce(mockGeminiResponse);

      const file = Buffer.from('test pdf data');
      await client.processWithVision(file, 'application/pdf', 75.5);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('application/pdf'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('rotated text'),
      );
    });
  });
});
