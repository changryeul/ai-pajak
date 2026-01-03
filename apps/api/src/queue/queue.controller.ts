import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TestQueueService, AddJobResponse, JobStatusResponse } from './test-queue.service';
import { AddTestJobDto } from './dto/add-test-job.dto';

@ApiTags('Queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly testQueueService: TestQueueService) {}

  @Post('test')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add test job to queue' })
  @ApiResponse({
    status: 201,
    description: 'Job added successfully',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: '1' },
        status: { type: 'string', example: 'queued' },
      },
    },
  })
  async addTestJob(@Body() data: AddTestJobDto): Promise<AddJobResponse> {
    return this.testQueueService.addTestJob(data);
  }

  @Get('test/:jobId')
  @ApiOperation({ summary: 'Get test job status' })
  @ApiParam({
    name: 'jobId',
    description: 'The job ID to check status',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: '1' },
        state: {
          type: 'string',
          enum: ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'],
        },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Hello Queue!' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: "Job with ID '999' not found" },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async getJobStatus(@Param('jobId') jobId: string): Promise<JobStatusResponse> {
    return this.testQueueService.getJobStatus(jobId);
  }
}
