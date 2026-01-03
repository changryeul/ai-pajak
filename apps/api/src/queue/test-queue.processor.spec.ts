import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TestQueueProcessor, TestJobData, TestJobResult } from './test-queue.processor';

describe('TestQueueProcessor', () => {
  let processor: TestQueueProcessor;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestQueueProcessor],
    }).compile();

    processor = module.get<TestQueueProcessor>(TestQueueProcessor);

    // Spy on logger methods
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('onActive', () => {
    it('should log when job starts', () => {
      const mockJob = {
        id: '123',
        data: { message: 'Test message' },
      } as Job<TestJobData>;

      processor.onActive(mockJob);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job started: 123'),
      );
    });
  });

  describe('onCompleted', () => {
    it('should log when job completes', () => {
      const mockJob = {
        id: '123',
        data: { message: 'Test' },
      } as Job<TestJobData>;
      const result: TestJobResult = { processed: true, message: 'Test' };

      processor.onCompleted(mockJob, result);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job completed: 123'),
      );
    });
  });

  describe('onFailed', () => {
    it('should log error when job fails', () => {
      const mockJob = {
        id: '123',
        data: { message: 'Test' },
      } as Job<TestJobData>;
      const error = new Error('Something went wrong');

      processor.onFailed(mockJob, error);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job failed: 123'),
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Something went wrong'),
      );
    });
  });

  describe('handleTestJob', () => {
    it('should process job and return result', async () => {
      const mockJob = {
        id: '123',
        data: { message: 'Hello Queue!' },
      } as Job<TestJobData>;

      const result = await processor.handleTestJob(mockJob);

      expect(result).toEqual({
        processed: true,
        message: 'Hello Queue!',
      });
    });

    it('should log processing message', async () => {
      const mockJob = {
        id: '456',
        data: { message: 'Test' },
      } as Job<TestJobData>;

      await processor.handleTestJob(mockJob);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing test job: 456'),
      );
    });
  });
});
