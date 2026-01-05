import { Controller, Get, Patch, Post, Param, Body, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { OcrJobStatusDto } from './dto/ocr-job-status.dto';
import { DocumentOcrResultDto, UpdateOcrResultDto, ConfirmOcrReviewDto } from './dto';
import { OcrService } from './ocr.service';

@ApiTags('OCR')
@Controller('ocr')
export class OcrController {
  constructor(
    @InjectQueue('ocr-processing') private readonly ocrQueue: Queue,
    private readonly ocrService: OcrService,
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

  /**
   * Get OCR result for a document (Story 2-5)
   * @param documentId - Document ID
   * @returns OCR result with document info and extracted data
   */
  @Get('documents/:id/result')
  @ApiOperation({ summary: 'Get OCR result for a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'OCR result retrieved successfully',
    type: DocumentOcrResultDto,
  })
  @ApiResponse({ status: 404, description: 'Document or OCR result not found' })
  async getOcrResult(@Param('id') documentId: string): Promise<DocumentOcrResultDto> {
    return this.ocrService.getOcrResult(documentId);
  }

  /**
   * Update a single OCR result field (Story 2-5)
   * @param documentId - Document ID
   * @param updateDto - Field update data
   */
  @Patch('documents/:id/result')
  @ApiOperation({ summary: 'Update OCR result field' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiBody({ type: UpdateOcrResultDto })
  @ApiResponse({ status: 200, description: 'Field updated successfully' })
  @ApiResponse({ status: 404, description: 'Document or OCR result not found' })
  @ApiResponse({ status: 400, description: 'Invalid field index' })
  async updateOcrResult(
    @Param('id') documentId: string,
    @Body() updateDto: UpdateOcrResultDto,
  ): Promise<void> {
    await this.ocrService.updateOcrField(documentId, updateDto.fieldIndex, updateDto.newValue);
  }

  /**
   * Confirm OCR review and update document status (Story 2-5)
   * @param documentId - Document ID
   * @param confirmDto - List of field updates
   */
  @Post('documents/:id/confirm')
  @ApiOperation({ summary: 'Confirm OCR review completion' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiBody({ type: ConfirmOcrReviewDto })
  @ApiResponse({ status: 200, description: 'Review confirmed successfully' })
  @ApiResponse({ status: 404, description: 'Document or OCR result not found' })
  async confirmOcrReview(
    @Param('id') documentId: string,
    @Body() confirmDto: ConfirmOcrReviewDto,
  ): Promise<void> {
    await this.ocrService.confirmOcrReview(documentId, confirmDto.updates);
  }
}
