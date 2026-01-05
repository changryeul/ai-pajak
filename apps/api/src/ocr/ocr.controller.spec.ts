import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { OcrController } from './ocr.controller';
import { Queue, Job } from 'bull';

describe('OcrController', () => {
  let module: TestingModule;
  let controller: OcrController;
  let ocrQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    const mockQueue = {
      getJob: jest.fn(),
    };

    module = await Test.createTestingModule({
      controllers: [OcrController],
      providers: [
        {
          provide: getQueueToken('ocr-processing'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    controller = module.get<OcrController>(OcrController);
    ocrQueue = module.get(getQueueToken('ocr-processing'));
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
});
