import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

/** Test job processing delay in milliseconds (for simulation purposes) */
const TEST_JOB_PROCESSING_DELAY_MS = 1000;

export interface TestJobData {
  message: string;
}

export interface TestJobResult {
  processed: boolean;
  message: string;
}

@Processor('test-queue')
export class TestQueueProcessor {
  private readonly logger = new Logger(TestQueueProcessor.name);

  @OnQueueActive()
  onActive(job: Job<TestJobData>) {
    this.logger.log(
      `Job started: ${job.id}, data: ${JSON.stringify(job.data)}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<TestJobData>, result: TestJobResult) {
    this.logger.log(
      `Job completed: ${job.id}, result: ${JSON.stringify(result)}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<TestJobData>, error: Error) {
    this.logger.error(`Job failed: ${job.id}, error: ${error.message}`);
  }

  @Process()
  async handleTestJob(job: Job<TestJobData>): Promise<TestJobResult> {
    this.logger.log(`Processing test job: ${job.id}`);

    // Simulation delay for testing purposes
    await new Promise((resolve) =>
      setTimeout(resolve, TEST_JOB_PROCESSING_DELAY_MS),
    );

    return { processed: true, message: job.data.message };
  }
}
