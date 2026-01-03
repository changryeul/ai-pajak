import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, JobStatus } from 'bull';
import { TestJobData } from './test-queue.processor';

export interface AddJobResponse {
  jobId: string;
  status: string;
}

export interface JobStatusResponse {
  jobId: string;
  state: JobStatus | 'stuck';
  data: TestJobData;
}

@Injectable()
export class TestQueueService {
  constructor(
    @InjectQueue('test-queue')
    private readonly testQueue: Queue<TestJobData>,
  ) {}

  async addTestJob(data: TestJobData): Promise<AddJobResponse> {
    const job = await this.testQueue.add(data);
    return { jobId: String(job.id), status: 'queued' };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const job = await this.testQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job with ID '${jobId}' not found`);
    }

    const state = await job.getState();
    return { jobId: String(job.id), state, data: job.data };
  }
}
