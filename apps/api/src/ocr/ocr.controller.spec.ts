import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { Queue, Job } from 'bull';
import { DocumentOcrResultDto } from './dto';

describe('OcrController', () => {
  let module: TestingModule;
  let controller: OcrController;
  let ocrQueue: jest.Mocked<Queue>;
  let ocrService: jest.Mocked<OcrService>;

  const mockOcrResult: DocumentOcrResultDto = {
    documentId: '123',
    fileUrl: '/api/documents/123/file',
    mimeType: 'image/jpeg',
    status: 'COMPLETED',
    results: [
      { text: 'Test text', confidence: 0.95, bbox: [[0, 0], [100, 0], [100, 20], [0, 20]], page: 1 },
    ],
    engine: 'PADDLEOCR',
    fallbackUsed: false,
    processingTimeMs: 1500,
  };

  beforeEach(async () => {
    const mockQueue = {
      getJob: jest.fn(),
    };

    const mockOcrService = {
      getOcrResult: jest.fn(),
      updateOcrField: jest.fn(),
      confirmOcrReview: jest.fn(),
    };

    module = await Test.createTestingModule({
      controllers: [OcrController],
      providers: [
        {
          provide: getQueueToken('ocr-processing'),
          useValue: mockQueue,
        },
        {
          provide: OcrService,
          useValue: mockOcrService,
        },
      ],
    }).compile();

    controller = module.get<OcrController>(OcrController);
    ocrQueue = module.get(getQueueToken('ocr-processing'));
    ocrService = module.get(OcrService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      // Arrange
      const jobId = '123';
      const mockJob = {
        id: jobId,
        data: { documentId: '456' },
        attemptsMade: 1,
        progress: jest.fn().mockReturnValue(50),
        getState: jest.fn().mockResolvedValue('active'),
      } as unknown as Job;

      ocrQueue.getJob.mockResolvedValue(mockJob);

      // Act
      const result = await controller.getJobStatus(jobId);

      // Assert
      expect(ocrQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(result).toEqual({
        jobId: '123',
        status: 'active',
        progress: 50,
        attemptsMade: 1,
        data: {
          documentId: '456',
        },
      });
    });

    it('should return completed status for completed job', async () => {
      // Arrange
      const jobId = '124';
      const mockJob = {
        id: jobId,
        data: { documentId: '789' },
        attemptsMade: 1,
        progress: jest.fn().mockReturnValue(100),
        getState: jest.fn().mockResolvedValue('completed'),
      } as unknown as Job;

      ocrQueue.getJob.mockResolvedValue(mockJob);

      // Act
      const result = await controller.getJobStatus(jobId);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
    });

    it('should return failed status for failed job', async () => {
      // Arrange
      const jobId = '125';
      const mockJob = {
        id: jobId,
        data: { documentId: '999' },
        attemptsMade: 3,
        progress: jest.fn().mockReturnValue(0),
        getState: jest.fn().mockResolvedValue('failed'),
      } as unknown as Job;

      ocrQueue.getJob.mockResolvedValue(mockJob);

      // Act
      const result = await controller.getJobStatus(jobId);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.attemptsMade).toBe(3);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      // Arrange
      const jobId = 'non-existent';
      ocrQueue.getJob.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getJobStatus(jobId)).rejects.toThrow(
        new NotFoundException(`OCR job ${jobId} not found`),
      );
    });

    it('should return waiting status for queued job', async () => {
      // Arrange
      const jobId = '126';
      const mockJob = {
        id: jobId,
        data: { documentId: '111' },
        attemptsMade: 0,
        progress: jest.fn().mockReturnValue(0),
        getState: jest.fn().mockResolvedValue('waiting'),
      } as unknown as Job;

      ocrQueue.getJob.mockResolvedValue(mockJob);

      // Act
      const result = await controller.getJobStatus(jobId);

      // Assert
      expect(result.status).toBe('waiting');
      expect(result.attemptsMade).toBe(0);
    });
  });

  // Story 2-5: OCR Review UI API Tests
  describe('getOcrResult', () => {
    it('should return OCR result for a document', async () => {
      // Arrange
      const documentId = '123';
      ocrService.getOcrResult.mockResolvedValue(mockOcrResult);

      // Act
      const result = await controller.getOcrResult(documentId);

      // Assert
      expect(ocrService.getOcrResult).toHaveBeenCalledWith(documentId);
      expect(result).toEqual(mockOcrResult);
    });

    it('should throw NotFoundException when document not found', async () => {
      // Arrange
      const documentId = 'non-existent';
      ocrService.getOcrResult.mockRejectedValue(
        new NotFoundException(`Document ${documentId} not found`),
      );

      // Act & Assert
      await expect(controller.getOcrResult(documentId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOcrResult', () => {
    it('should update a single OCR field', async () => {
      // Arrange
      const documentId = '123';
      const updateDto = { fieldIndex: 0, newValue: 'Updated text' };
      ocrService.updateOcrField.mockResolvedValue(undefined);

      // Act
      await controller.updateOcrResult(documentId, updateDto);

      // Assert
      expect(ocrService.updateOcrField).toHaveBeenCalledWith(
        documentId,
        updateDto.fieldIndex,
        updateDto.newValue,
      );
    });

    it('should throw BadRequestException for invalid field index', async () => {
      // Arrange
      const documentId = '123';
      const updateDto = { fieldIndex: 999, newValue: 'Invalid' };
      ocrService.updateOcrField.mockRejectedValue(
        new BadRequestException('Invalid field index: 999'),
      );

      // Act & Assert
      await expect(controller.updateOcrResult(documentId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('confirmOcrReview', () => {
    it('should confirm OCR review with updates', async () => {
      // Arrange
      const documentId = '123';
      const confirmDto = {
        updates: [
          { index: 0, newValue: 'Updated text 1' },
          { index: 1, newValue: 'Updated text 2' },
        ],
      };
      ocrService.confirmOcrReview.mockResolvedValue(undefined);

      // Act
      await controller.confirmOcrReview(documentId, confirmDto);

      // Assert
      expect(ocrService.confirmOcrReview).toHaveBeenCalledWith(documentId, confirmDto.updates);
    });

    it('should confirm OCR review without updates', async () => {
      // Arrange
      const documentId = '123';
      const confirmDto = { updates: [] };
      ocrService.confirmOcrReview.mockResolvedValue(undefined);

      // Act
      await controller.confirmOcrReview(documentId, confirmDto);

      // Assert
      expect(ocrService.confirmOcrReview).toHaveBeenCalledWith(documentId, []);
    });

    it('should throw NotFoundException when document not found', async () => {
      // Arrange
      const documentId = 'non-existent';
      const confirmDto = { updates: [] };
      ocrService.confirmOcrReview.mockRejectedValue(
        new NotFoundException(`Document ${documentId} not found`),
      );

      // Act & Assert
      await expect(controller.confirmOcrReview(documentId, confirmDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
