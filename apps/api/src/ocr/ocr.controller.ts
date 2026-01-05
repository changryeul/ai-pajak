import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { OcrJobStatusDto } from './dto/ocr-job-status.dto';

@ApiTags('OCR')
@Controller('ocr')
export class OcrController {
  constructor(
    @InjectQueue('ocr-processing') private readonly ocrQueue: Queue,
  ) {}

  /**
   * Get OCR job status by job ID
   * @param jobId - Bull Queue job ID
   * @returns Job status information
   */
  @Get('status/:jobId')
  @ApiOperation({ summary: 'Get OCR job status' })
  @ApiParam({ name: 'jobId', description: 'OCR job ID from document upload' })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
    type: OcrJobStatusDto,
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('jobId') jobId: string): Promise<OcrJobStatusDto> {
    const job = await this.ocrQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`OCR job ${jobId} not found`);
    }

    const state = await job.getState();

    return {
      jobId: job.id.toString(),
      status: state,
      progress: job.progress(),
      attemptsMade: job.attemptsMade,
      data: {
        documentId: job.data.documentId,
      },
    };
  }
}
