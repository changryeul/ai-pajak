import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException } from '@nestjs/common';
import { TestQueueService } from './test-queue.service';

describe('TestQueueService', () => {
  let service: TestQueueService;
  let mockQueue: {
    add: jest.Mock;
    getJob: jest.Mock;
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestQueueService,
        {
          provide: getQueueToken('test-queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<TestQueueService>(TestQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addTestJob', () => {
    it('should add a job to the queue and return job info', async () => {
      const testData = { message: 'Hello Queue!' };
      const mockJob = { id: '123' };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.addTestJob(testData);

      expect(mockQueue.add).toHaveBeenCalledWith(testData);
      expect(result).toEqual({
        jobId: '123',
        status: 'queued',
      });
    });

    it('should convert numeric job ID to string', async () => {
      const testData = { message: 'Test' };
      const mockJob = { id: 456 };
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.addTestJob(testData);

      expect(result.jobId).toBe('456');
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      const mockJob = {
        id: '123',
        data: { message: 'Hello' },
        getState: jest.fn().mockResolvedValue('completed'),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('123');

      expect(mockQueue.getJob).toHaveBeenCalledWith('123');
      expect(result).toEqual({
        jobId: '123',
        state: 'completed',
        data: { message: 'Hello' },
      });
    });

    it('should throw NotFoundException when job does not exist', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(service.getJobStatus('999')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getJobStatus('999')).rejects.toThrow(
        "Job with ID '999' not found",
      );
    });

    it('should handle different job states', async () => {
      const states = ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'];

      for (const state of states) {
        const mockJob = {
          id: '1',
          data: { message: 'Test' },
          getState: jest.fn().mockResolvedValue(state),
        };
        mockQueue.getJob.mockResolvedValue(mockJob);

        const result = await service.getJobStatus('1');
        expect(result.state).toBe(state);
      }
    });
  });
});
