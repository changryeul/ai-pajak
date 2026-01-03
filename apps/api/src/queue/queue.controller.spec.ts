import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { TestQueueService } from './test-queue.service';

describe('QueueController', () => {
  let controller: QueueController;
  let mockTestQueueService: {
    addTestJob: jest.Mock;
    getJobStatus: jest.Mock;
  };

  beforeEach(async () => {
    mockTestQueueService = {
      addTestJob: jest.fn(),
      getJobStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: TestQueueService,
          useValue: mockTestQueueService,
        },
      ],
    }).compile();

    controller = module.get<QueueController>(QueueController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addTestJob', () => {
    it('should add a job and return response', async () => {
      const dto = { message: 'Hello Queue!' };
      const expectedResponse = { jobId: '1', status: 'queued' };
      mockTestQueueService.addTestJob.mockResolvedValue(expectedResponse);

      const result = await controller.addTestJob(dto);

      expect(mockTestQueueService.addTestJob).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      const expectedResponse = {
        jobId: '1',
        state: 'completed',
        data: { message: 'Hello' },
      };
      mockTestQueueService.getJobStatus.mockResolvedValue(expectedResponse);

      const result = await controller.getJobStatus('1');

      expect(mockTestQueueService.getJobStatus).toHaveBeenCalledWith('1');
      expect(result).toEqual(expectedResponse);
    });

    it('should throw NotFoundException when job not found', async () => {
      mockTestQueueService.getJobStatus.mockRejectedValue(
        new NotFoundException("Job with ID '999' not found"),
      );

      await expect(controller.getJobStatus('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
