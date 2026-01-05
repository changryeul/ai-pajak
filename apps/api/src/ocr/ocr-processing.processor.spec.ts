import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';
import { OcrProcessingProcessor } from './ocr-processing.processor';
import { OcrService } from './ocr.service';
import { OcrQueueJobData } from '../document/types/document.types';
import { OcrResultWithFallback } from './types/ocr.types';

describe('OcrProcessingProcessor', () => {
  let module: TestingModule;
  let processor: OcrProcessingProcessor;
  let ocrService: jest.Mocked<OcrService>;

  // Mock response with fallback info
  const mockOcrResultWithFallback: OcrResultWithFallback = {
    success: true,
    processing_time_ms: 1500,
    results: [
      { text: 'Test text', confidence: 0.95, bbox: [[0, 0], [100, 0], [100, 20], [0, 20]], page: 1 },
    ],
    engine: 'PADDLEOCR',
    model_version: '1.0.0',
    fallbackUsed: false,
    originalPaddleConfidence: 0.95,
  };

  const mockJobData: OcrQueueJobData = {
    documentId: '123',
    filePath: './uploads/test.pdf',
    mimeType: 'application/pdf',
  };

  beforeEach(async () => {
    const mockOcrService = {
      processDocumentWithFallback: jest.fn(),
      saveOcrResultWithFallback: jest.fn(),
      updateDocumentStatus: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        OcrProcessingProcessor,
        {
          provide: OcrService,
          useValue: mockOcrService,
        },
      ],
    }).compile();

    processor = module.get<OcrProcessingProcessor>(OcrProcessingProcessor);
    ocrService = module.get(OcrService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('handleOcrProcessing', () => {
    it('should successfully process a document through OCR with fallback support', async () => {
      // Arrange
      ocrService.processDocumentWithFallback.mockResolvedValue(mockOcrResultWithFallback);
      ocrService.saveOcrResultWithFallback.mockResolvedValue(undefined);
      ocrService.updateDocumentStatus.mockResolvedValue(undefined);

      const mockJob = {
        data: mockJobData,
        id: '1',
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<OcrQueueJobData>;

      // Act
      await processor.handleOcrProcessing(mockJob);

      // Assert
      expect(ocrService.processDocumentWithFallback).toHaveBeenCalledWith(
        mockJobData.documentId,
        mockJobData.filePath,
        mockJobData.mimeType,
      );
      expect(ocrService.saveOcrResultWithFallback).toHaveBeenCalledWith(
        mockJobData.documentId,
        mockOcrResultWithFallback,
        expect.any(Number),
      );
      expect(ocrService.updateDocumentStatus).toHaveBeenCalledWith(
        mockJobData.documentId,
        'COMPLETED',
      );
    });

    it('should update document status to COMPLETED on success', async () => {
      // Arrange
      ocrService.processDocumentWithFallback.mockResolvedValue(mockOcrResultWithFallback);
      ocrService.saveOcrResultWithFallback.mockResolvedValue(undefined);
      ocrService.updateDocumentStatus.mockResolvedValue(undefined);

      const mockJob = {
        data: mockJobData,
        id: '2',
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<OcrQueueJobData>;

      // Act
      await processor.handleOcrProcessing(mockJob);

      // Assert
      expect(ocrService.updateDocumentStatus).toHaveBeenCalledWith(
        mockJobData.documentId,
        'COMPLETED',
      );
    });

    it('should throw error for retry on failure', async () => {
      // Arrange
      const error = new Error('OCR processing failed');
      ocrService.processDocumentWithFallback.mockRejectedValue(error);

      const mockJob = {
        data: mockJobData,
        id: '3',
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<OcrQueueJobData>;

      // Act & Assert
      await expect(processor.handleOcrProcessing(mockJob)).rejects.toThrow(error);
      expect(ocrService.updateDocumentStatus).not.toHaveBeenCalled();
    });

    it('should handle Gemini fallback result correctly', async () => {
      // Arrange - Gemini fallback used
      const geminiResult: OcrResultWithFallback = {
        success: true,
        processing_time_ms: 2000,
        results: [
          { text: 'Gemini text', confidence: null, bbox: [], page: 1 },
        ],
        engine: 'GEMINI',
        model_version: 'gemini-3.0-flash',
        fallbackUsed: true,
        originalPaddleConfidence: 0.7,
      };

      ocrService.processDocumentWithFallback.mockResolvedValue(geminiResult);
      ocrService.saveOcrResultWithFallback.mockResolvedValue(undefined);
      ocrService.updateDocumentStatus.mockResolvedValue(undefined);

      const mockJob = {
        data: mockJobData,
        id: '4',
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<OcrQueueJobData>;

      // Act
      await processor.handleOcrProcessing(mockJob);

      // Assert
      expect(ocrService.saveOcrResultWithFallback).toHaveBeenCalledWith(
        mockJobData.documentId,
        geminiResult,
        expect.any(Number),
      );
    });
  });

  describe('handleFailedJob', () => {
    it('should update document status to FAILED after max retries', async () => {
      // Arrange
      ocrService.updateDocumentStatus.mockResolvedValue(undefined);
      const error = new Error('OCR processing failed');

      const mockJob = {
        data: mockJobData,
        id: '4',
        attemptsMade: 3,
      } as Job<OcrQueueJobData>;

      // Act
      await processor.handleFailedJob(mockJob, error);

      // Assert
      expect(ocrService.updateDocumentStatus).toHaveBeenCalledWith(
        mockJobData.documentId,
        'FAILED',
      );
    });

    it('should not update status if attempts are less than max', async () => {
      // Arrange
      const error = new Error('OCR processing failed');

      const mockJob = {
        data: mockJobData,
        id: '5',
        attemptsMade: 2,
      } as Job<OcrQueueJobData>;

      // Act
      await processor.handleFailedJob(mockJob, error);

      // Assert
      expect(ocrService.updateDocumentStatus).not.toHaveBeenCalled();
    });
  });
});
