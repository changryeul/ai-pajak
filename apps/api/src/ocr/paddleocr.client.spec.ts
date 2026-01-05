import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PaddleOcrClient } from './paddleocr.client';
import {
  OcrServiceUnavailableException,
  OcrProcessingException,
  OcrTimeoutException,
} from './exceptions';
import { OcrResponse } from './types/ocr.types';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PaddleOcrClient', () => {
  let client: PaddleOcrClient;
  let configService: ConfigService;

  const mockOcrResponse: OcrResponse = {
    success: true,
    processing_time_ms: 1234,
    results: [
      {
        text: 'Test OCR result',
        confidence: 0.95,
        bbox: [[0, 0], [100, 0], [100, 50], [0, 50]],
        page: 1,
      },
    ],
    tables: [],
    engine: 'PADDLEOCR',
    model_version: 'PP-OCRv5',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaddleOcrClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'PADDLEOCR_SERVICE_URL') return 'http://localhost:8080';
              if (key === 'PADDLEOCR_TIMEOUT_MS') return 30000;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    client = module.get<PaddleOcrClient>(PaddleOcrClient);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('process', () => {
    it('should successfully process an image', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockOcrResponse),
      });

      const file = Buffer.from('test image data');
      const result = await client.process(file, 'image/png', 'test.png');

      expect(result).toEqual(mockOcrResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/ocr/process',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should throw OcrProcessingException on 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const file = Buffer.from('test image data');

      await expect(client.process(file, 'image/png', 'test.png')).rejects.toThrow(
        OcrProcessingException,
      );
    });

    it('should retry on 5xx errors', async () => {
      // First call fails with 500, second succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockOcrResponse),
        });

      const file = Buffer.from('test image data');

      // Start the process
      const processPromise = client.process(file, 'image/png', 'test.png');

      // Advance timer for backoff delay (1 second for first retry)
      await jest.advanceTimersByTimeAsync(1000);

      const result = await processPromise;

      expect(result).toEqual(mockOcrResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry with exponential backoff', async () => {
      // Three failures, fourth succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockOcrResponse),
        });

      const file = Buffer.from('test image data');

      const processPromise = client.process(file, 'image/png', 'test.png');

      // First backoff: 1 second
      await jest.advanceTimersByTimeAsync(1000);
      // Second backoff: 2 seconds
      await jest.advanceTimersByTimeAsync(2000);

      const result = await processPromise;

      expect(result).toEqual(mockOcrResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw OcrProcessingException after max retries on 5xx errors', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const file = Buffer.from('test image data');

      let caughtError: Error | undefined;
      const processPromise = client.process(file, 'image/png', 'test.png').catch((e) => {
        caughtError = e;
      });

      // Advance through all backoff delays
      await jest.advanceTimersByTimeAsync(10000);
      await processPromise;

      expect(caughtError).toBeInstanceOf(OcrProcessingException);
    });

    it('should throw OcrTimeoutException on timeout after retries', async () => {
      const timeoutError = new Error('TimeoutError');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValue(timeoutError);

      const file = Buffer.from('test image data');

      let caughtError: Error | undefined;
      const processPromise = client.process(file, 'image/png', 'test.png').catch((e) => {
        caughtError = e;
      });

      // Advance through all backoff delays
      await jest.advanceTimersByTimeAsync(10000);
      await processPromise;

      expect(caughtError).toBeInstanceOf(OcrTimeoutException);
    });

    it('should throw OcrServiceUnavailableException on network error after retries', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValue(networkError);

      const file = Buffer.from('test image data');

      let caughtError: Error | undefined;
      const processPromise = client.process(file, 'image/png', 'test.png').catch((e) => {
        caughtError = e;
      });

      // Advance through all backoff delays
      await jest.advanceTimersByTimeAsync(10000);
      await processPromise;

      expect(caughtError).toBeInstanceOf(OcrServiceUnavailableException);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when service is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ status: 'healthy' }),
      });

      const result = await client.healthCheck();

      expect(result).toEqual({ status: 'healthy' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/health',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return unhealthy status on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const result = await client.healthCheck();

      expect(result).toEqual({ status: 'unhealthy' });
    });

    it('should return unhealthy status on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.healthCheck();

      expect(result).toEqual({ status: 'unhealthy' });
    });
  });

  describe('getInfo', () => {
    it('should return service info when available', async () => {
      const mockInfo = {
        version: 'PP-OCRv5',
        model: 'ch_PP-OCRv5_det',
        supported_formats: ['image/jpeg', 'image/png', 'application/pdf'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockInfo),
      });

      const result = await client.getInfo();

      expect(result).toEqual(mockInfo);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/info',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should throw OcrServiceUnavailableException on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(client.getInfo()).rejects.toThrow(OcrServiceUnavailableException);
    });

    it('should throw OcrServiceUnavailableException on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getInfo()).rejects.toThrow(OcrServiceUnavailableException);
    });
  });

  describe('configuration', () => {
    it('should use environment variables for configuration', () => {
      expect(configService.get).toHaveBeenCalledWith(
        'PADDLEOCR_SERVICE_URL',
        'http://localhost:8080',
      );
      expect(configService.get).toHaveBeenCalledWith(
        'PADDLEOCR_TIMEOUT_MS',
        30000,
      );
    });
  });

  describe('input validation', () => {
    it('should throw BadRequestException for empty file buffer', async () => {
      const emptyFile = Buffer.alloc(0);

      await expect(
        client.process(emptyFile, 'image/png', 'test.png'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty filename', async () => {
      const file = Buffer.from('test image data');

      await expect(client.process(file, 'image/png', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for whitespace-only filename', async () => {
      const file = Buffer.from('test image data');

      await expect(client.process(file, 'image/png', '   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for unsupported MIME type', async () => {
      const file = Buffer.from('test image data');

      await expect(
        client.process(file, 'image/gif', 'test.gif'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept supported MIME types', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockOcrResponse),
      });

      const file = Buffer.from('test image data');

      // Should not throw for supported types
      await expect(
        client.process(file, 'image/jpeg', 'test.jpg'),
      ).resolves.toBeDefined();
      await expect(
        client.process(file, 'image/png', 'test.png'),
      ).resolves.toBeDefined();
      await expect(
        client.process(file, 'application/pdf', 'test.pdf'),
      ).resolves.toBeDefined();
    });
  });
});
