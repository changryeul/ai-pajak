import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OcrService } from './ocr.service';
import { PrismaService } from '../repository/prisma.service';
import { PaddleOcrClient } from './paddleocr.client';
import { GeminiClient, GeminiOcrResponse } from './gemini.client';
import { OcrResponse, OcrResultWithFallback } from './types/ocr.types';
import { GeminiFallbackException } from './exceptions';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('OcrService', () => {
  let module: TestingModule;
  let service: OcrService;
  let prismaService: jest.Mocked<PrismaService>;
  let paddleOcrClient: jest.Mocked<PaddleOcrClient>;
  let geminiClient: jest.Mocked<GeminiClient>;

  // High confidence response (90%) - above 85% threshold
  const mockHighConfidenceResponse: OcrResponse = {
    success: true,
    processing_time_ms: 1500,
    results: [
      { text: 'Test text 1', confidence: 0.95, bbox: [[0, 0], [100, 0], [100, 20], [0, 20]], page: 1 },
      { text: 'Test text 2', confidence: 0.85, bbox: [[0, 25], [100, 25], [100, 45], [0, 45]], page: 1 },
    ],
    engine: 'PADDLEOCR',
    model_version: '1.0.0',
  };

  // Low confidence response (70%) - below 85% threshold
  const mockLowConfidenceResponse: OcrResponse = {
    success: true,
    processing_time_ms: 1500,
    results: [
      { text: 'Test text 1', confidence: 0.75, bbox: [[0, 0], [100, 0], [100, 20], [0, 20]], page: 1 },
      { text: 'Test text 2', confidence: 0.65, bbox: [[0, 25], [100, 25], [100, 45], [0, 45]], page: 1 },
    ],
    engine: 'PADDLEOCR',
    model_version: '1.0.0',
  };

  // Gemini response (no confidence)
  const mockGeminiResponse: GeminiOcrResponse = {
    success: true,
    processing_time_ms: 2000,
    results: [
      { text: 'Gemini extracted text 1', confidence: null, bbox: [], page: 1 },
      { text: 'Gemini extracted text 2', confidence: null, bbox: [], page: 1 },
    ],
    engine: 'GEMINI',
    model_version: 'gemini-3.0-flash',
  };

  // Legacy alias for backward compatibility
  const mockOcrResponse = mockHighConfidenceResponse;

  beforeEach(async () => {
    const mockPrismaService = {
      document: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      aIResult: {
        create: jest.fn(),
      },
    };

    const mockPaddleOcrClient = {
      process: jest.fn(),
    };

    const mockGeminiClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      isSupportedMimeType: jest.fn().mockReturnValue(true),
      processWithVision: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'GEMINI_FALLBACK_THRESHOLD') return 0.85;
        return defaultValue;
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        OcrService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PaddleOcrClient,
          useValue: mockPaddleOcrClient,
        },
        {
          provide: GeminiClient,
          useValue: mockGeminiClient,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<OcrService>(OcrService);
    prismaService = module.get(PrismaService);
    paddleOcrClient = module.get(PaddleOcrClient);
    geminiClient = module.get(GeminiClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('processDocument', () => {
    it('should read file and call PaddleOcrClient', async () => {
      // Arrange
      const documentId = '123';
      // Use relative path inside uploads directory (matches default UPLOAD_DIR)
      const filePath = './uploads/test.pdf';
      const mimeType = 'application/pdf';
      const fileBuffer = Buffer.from('test file content');

      (fs.readFile as jest.Mock).mockResolvedValue(fileBuffer);
      paddleOcrClient.process.mockResolvedValue(mockOcrResponse);

      // Act
      const result = await service.processDocument(documentId, filePath, mimeType);

      // Assert
      expect(fs.readFile).toHaveBeenCalledWith(filePath);
      expect(paddleOcrClient.process).toHaveBeenCalledWith(
        fileBuffer,
        mimeType,
        'test.pdf',
      );
      expect(result).toEqual(mockOcrResponse);
    });

    it('should throw BadRequestException for path traversal attempt', async () => {
      // Arrange
      const documentId = '123';
      const maliciousPath = '../../../etc/passwd';
      const mimeType = 'application/pdf';

      // Act & Assert
      await expect(
        service.processDocument(documentId, maliciousPath, mimeType),
      ).rejects.toThrow('Invalid file path');
    });
  });

  describe('saveOcrResult', () => {
    it('should save OCR result to AIResult table', async () => {
      // Arrange
      const documentId = '123';
      const processingTimeMs = 1500;
      const taxCaseId = BigInt(456);

      (prismaService.document.findUnique as jest.Mock).mockResolvedValue({
        taxCaseId,
      });
      (prismaService.aIResult.create as jest.Mock).mockResolvedValue({ id: BigInt(1) });

      // Act
      await service.saveOcrResult(documentId, mockOcrResponse, processingTimeMs);

      // Assert
      expect(prismaService.document.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(documentId) },
        select: { taxCaseId: true },
      });
      expect(prismaService.aIResult.create).toHaveBeenCalledWith({
        data: {
          taxCaseId,
          suggestedTax: '',
          confidence: expect.any(Number), // (0.95 + 0.85) / 2 / 100
          rawResponse: mockOcrResponse,
          ocrEngine: 'PADDLEOCR',
          confidenceScore: 0.9, // (0.95 + 0.85) / 2 = 0.9
          processingTimeMs,
          fallbackUsed: false,
        },
      });
    });

    it('should handle document without taxCaseId', async () => {
      // Arrange
      const documentId = '123';
      const processingTimeMs = 1500;

      (prismaService.document.findUnique as jest.Mock).mockResolvedValue({
        taxCaseId: null,
      });

      // Act
      await service.saveOcrResult(documentId, mockOcrResponse, processingTimeMs);

      // Assert
      expect(prismaService.aIResult.create).not.toHaveBeenCalled();
    });
  });

  describe('updateDocumentStatus', () => {
    it('should update document status to COMPLETED', async () => {
      // Arrange
      const documentId = '123';
      (prismaService.document.update as jest.Mock).mockResolvedValue({ id: BigInt(123) });

      // Act
      await service.updateDocumentStatus(documentId, 'COMPLETED');

      // Assert
      expect(prismaService.document.update).toHaveBeenCalledWith({
        where: { id: BigInt(documentId) },
        data: { status: 'COMPLETED' },
      });
    });

    it('should update document status to FAILED', async () => {
      // Arrange
      const documentId = '123';
      (prismaService.document.update as jest.Mock).mockResolvedValue({ id: BigInt(123) });

      // Act
      await service.updateDocumentStatus(documentId, 'FAILED');

      // Assert
      expect(prismaService.document.update).toHaveBeenCalledWith({
        where: { id: BigInt(documentId) },
        data: { status: 'FAILED' },
      });
    });
  });

  describe('calculateAverageConfidence', () => {
    it('should calculate average confidence correctly', async () => {
      // Arrange
      const documentId = '123';
      const processingTimeMs = 1500;
      const taxCaseId = BigInt(456);

      (prismaService.document.findUnique as jest.Mock).mockResolvedValue({
        taxCaseId,
      });
      (prismaService.aIResult.create as jest.Mock).mockResolvedValue({ id: BigInt(1) });

      // Act
      await service.saveOcrResult(documentId, mockOcrResponse, processingTimeMs);

      // Assert - average of 0.95 and 0.85 = 0.9
      expect(prismaService.aIResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            confidenceScore: 0.9,
          }),
        }),
      );
    });

    it('should return 0 for empty results', async () => {
      // Arrange
      const documentId = '123';
      const processingTimeMs = 1500;
      const taxCaseId = BigInt(456);
      const emptyOcrResponse: OcrResponse = {
        ...mockOcrResponse,
        results: [],
      };

      (prismaService.document.findUnique as jest.Mock).mockResolvedValue({
        taxCaseId,
      });
      (prismaService.aIResult.create as jest.Mock).mockResolvedValue({ id: BigInt(1) });

      // Act
      await service.saveOcrResult(documentId, emptyOcrResponse, processingTimeMs);

      // Assert
      expect(prismaService.aIResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            confidenceScore: 0,
          }),
        }),
      );
    });
  });

  describe('validateDocumentId', () => {
    it('should throw BadRequestException for invalid documentId', async () => {
      // Arrange
      const invalidDocumentId = 'not-a-number';
      const processingTimeMs = 1500;

      // Act & Assert
      await expect(
        service.saveOcrResult(invalidDocumentId, mockOcrResponse, processingTimeMs),
      ).rejects.toThrow('Invalid document ID format');
    });

    it('should throw BadRequestException for documentId with special characters', async () => {
      // Arrange
      const invalidDocumentId = '123abc';
      const processingTimeMs = 1500;

      // Act & Assert
      await expect(
        service.saveOcrResult(invalidDocumentId, mockOcrResponse, processingTimeMs),
      ).rejects.toThrow('Invalid document ID format');
    });
  });

  describe('processDocumentWithFallback', () => {
    const documentId = '123';
    const filePath = './uploads/test.pdf';
    const mimeType = 'application/pdf';
    const fileBuffer = Buffer.from('test file content');

    beforeEach(() => {
      (fs.readFile as jest.Mock).mockResolvedValue(fileBuffer);
    });

    describe('when confidence >= 85% threshold', () => {
      it('should NOT trigger Gemini fallback and use PaddleOCR result', async () => {
        // Arrange - High confidence (90%)
        paddleOcrClient.process.mockResolvedValue(mockHighConfidenceResponse);

        // Act
        const result = await service.processDocumentWithFallback(
          documentId,
          filePath,
          mimeType,
        );

        // Assert
        expect(result.fallbackUsed).toBe(false);
        expect(result.engine).toBe('PADDLEOCR');
        expect(result.originalPaddleConfidence).toBe(0.9); // (0.95 + 0.85) / 2
        expect(geminiClient.processWithVision).not.toHaveBeenCalled();
      });

      it('should preserve original PaddleOCR confidence in result', async () => {
        // Arrange
        paddleOcrClient.process.mockResolvedValue(mockHighConfidenceResponse);

        // Act
        const result = await service.processDocumentWithFallback(
          documentId,
          filePath,
          mimeType,
        );

        // Assert
        expect(result.originalPaddleConfidence).toBeCloseTo(0.9, 2);
      });
    });

    describe('when confidence < 85% threshold', () => {
      it('should trigger Gemini fallback', async () => {
        // Arrange - Low confidence (70%)
        paddleOcrClient.process.mockResolvedValue(mockLowConfidenceResponse);
        geminiClient.processWithVision.mockResolvedValue(mockGeminiResponse);

        // Act
        const result = await service.processDocumentWithFallback(
          documentId,
          filePath,
          mimeType,
        );

        // Assert
        expect(result.fallbackUsed).toBe(true);
        expect(result.engine).toBe('GEMINI');
        expect(geminiClient.processWithVision).toHaveBeenCalledWith(
          fileBuffer,
          mimeType,
          expect.any(Number), // original confidence
        );
      });

      it('should include originalPaddleConfidence in Gemini result', async () => {
        // Arrange
        paddleOcrClient.process.mockResolvedValue(mockLowConfidenceResponse);
        geminiClient.processWithVision.mockResolvedValue(mockGeminiResponse);

        // Act
        const result = await service.processDocumentWithFallback(
          documentId,
          filePath,
          mimeType,
        );

        // Assert
        expect(result.originalPaddleConfidence).toBeCloseTo(0.7, 2); // (0.75 + 0.65) / 2
      });
    });

    describe('when Gemini fallback fails', () => {
      it('should fall back to PaddleOCR original result (AC #4)', async () => {
        // Arrange - Low confidence triggers fallback, but Gemini fails
        paddleOcrClient.process.mockResolvedValue(mockLowConfidenceResponse);
        geminiClient.processWithVision.mockRejectedValue(
          new GeminiFallbackException('Gemini API failed', 70),
        );

        // Act
        const result = await service.processDocumentWithFallback(
          documentId,
          filePath,
          mimeType,
        );

        // Assert - Falls back to PaddleOCR result
        expect(result.fallbackUsed).toBe(false);
        expect(result.geminiFailed).toBe(true);
        expect(result.engine).toBe('PADDLEOCR');
        expect(result.results).toEqual(mockLowConfidenceResponse.results);
      });

      it('should include original confidence when falling back to PaddleOCR', async () => {
        // Arrange
        paddleOcrClient.process.mockResolvedValue(mockLowConfidenceResponse);
        geminiClient.processWithVision.mockRejectedValue(
          new GeminiFallbackException('Gemini API failed', 70),
        );

        // Act
        const result = await service.processDocumentWithFallback(
          documentId,
          filePath,
          mimeType,
        );

        // Assert
        expect(result.originalPaddleConfidence).toBeCloseTo(0.7, 2);
      });
    });

    describe('when Gemini is not configured', () => {
      it('should use PaddleOCR result even with low confidence', async () => {
        // Arrange
        paddleOcrClient.process.mockResolvedValue(mockLowConfidenceResponse);
        geminiClient.isConfigured.mockReturnValue(false);

        // Act
        const result = await service.processDocumentWithFallback(
          documentId,
          filePath,
          mimeType,
        );

        // Assert
        expect(result.fallbackUsed).toBe(false);
        expect(result.geminiFailed).toBe(true);
        expect(result.engine).toBe('PADDLEOCR');
        expect(geminiClient.processWithVision).not.toHaveBeenCalled();
      });
    });
  });

  describe('saveOcrResultWithFallback', () => {
    const documentId = '123';
    const taxCaseId = BigInt(456);

    beforeEach(() => {
      (prismaService.document.findUnique as jest.Mock).mockResolvedValue({
        taxCaseId,
      });
      (prismaService.aIResult.create as jest.Mock).mockResolvedValue({ id: BigInt(1) });
    });

    it('should save PaddleOCR result with fallbackUsed=false', async () => {
      // Arrange
      const paddleResult: OcrResultWithFallback = {
        ...mockHighConfidenceResponse,
        fallbackUsed: false,
        originalPaddleConfidence: 0.9,
      };

      // Act
      await service.saveOcrResultWithFallback(documentId, paddleResult, 1500);

      // Assert
      expect(prismaService.aIResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ocrEngine: 'PADDLEOCR',
          fallbackUsed: false,
          confidenceScore: 0.9,
        }),
      });
    });

    it('should save Gemini result with fallbackUsed=true and null confidence', async () => {
      // Arrange
      const geminiResult: OcrResultWithFallback = {
        ...mockGeminiResponse,
        fallbackUsed: true,
        originalPaddleConfidence: 0.7,
      };

      // Act
      await service.saveOcrResultWithFallback(documentId, geminiResult, 2000);

      // Assert
      expect(prismaService.aIResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ocrEngine: 'GEMINI',
          fallbackUsed: true,
          confidenceScore: null, // Gemini doesn't provide confidence
          confidence: 0, // Legacy field: 0 for Gemini
        }),
      });
    });

    it('should include originalPaddleConfidence in rawResponse', async () => {
      // Arrange
      const geminiResult: OcrResultWithFallback = {
        ...mockGeminiResponse,
        fallbackUsed: true,
        originalPaddleConfidence: 0.7,
      };

      // Act
      await service.saveOcrResultWithFallback(documentId, geminiResult, 2000);

      // Assert
      expect(prismaService.aIResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rawResponse: expect.objectContaining({
            originalPaddleConfidence: 0.7,
          }),
        }),
      });
    });
  });

  describe('calculateAverageConfidence', () => {
    it('should handle null confidence values (Gemini results)', () => {
      // Arrange
      const geminiResult: OcrResponse = {
        success: true,
        processing_time_ms: 2000,
        results: [
          { text: 'Text 1', confidence: null, bbox: [], page: 1 },
          { text: 'Text 2', confidence: null, bbox: [], page: 1 },
        ],
        engine: 'GEMINI',
        model_version: 'gemini-2.0-flash',
      };

      // Act
      const avgConfidence = service.calculateAverageConfidence(geminiResult);

      // Assert - Should return 0 when all confidence values are null
      expect(avgConfidence).toBe(0);
    });

    it('should calculate average only from non-null confidence values', () => {
      // Arrange - Mixed results (hypothetical scenario)
      const mixedResult: OcrResponse = {
        success: true,
        processing_time_ms: 2000,
        results: [
          { text: 'Text 1', confidence: 0.8, bbox: [], page: 1 },
          { text: 'Text 2', confidence: null, bbox: [], page: 1 },
          { text: 'Text 3', confidence: 0.6, bbox: [], page: 1 },
        ],
        engine: 'PADDLEOCR',
        model_version: '1.0.0',
      };

      // Act
      const avgConfidence = service.calculateAverageConfidence(mixedResult);

      // Assert - (0.8 + 0.6) / 2 = 0.7
      expect(avgConfidence).toBeCloseTo(0.7, 2);
    });
  });
});
