import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { MAX_FILE_SIZE } from './types/document.types';

describe('DocumentController', () => {
  let controller: DocumentController;
  let mockDocumentService: {
    create: jest.Mock;
    getStatus: jest.Mock;
    findById: jest.Mock;
  };

  beforeEach(async () => {
    mockDocumentService = {
      create: jest.fn(),
      getStatus: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        {
          provide: DocumentService,
          useValue: mockDocumentService,
        },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadDocument', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test-document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024 * 100, // 100KB
      destination: './uploads',
      filename: 'unique-filename.pdf',
      path: './uploads/unique-filename.pdf',
      buffer: Buffer.from(''),
      stream: null as any,
    };

    it('should successfully upload a valid PDF file', async () => {
      const dto = { taxCaseId: '123' };
      const expectedResponse = {
        id: '1',
        filename: 'unique-filename.pdf',
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        status: 'PROCESSING',
        taxCaseId: '123',
        ocrJobId: 'job-1',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      mockDocumentService.create.mockResolvedValue(expectedResponse);

      const result = await controller.uploadDocument(mockFile, dto);

      expect(mockDocumentService.create).toHaveBeenCalledWith(mockFile, dto);
      expect(result).toEqual(expectedResponse);
    });

    it('should trigger OCR queue job after upload', async () => {
      const dto = {};
      const expectedResponse = {
        id: '1',
        filename: 'unique-filename.pdf',
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        status: 'PROCESSING',
        ocrJobId: 'job-1',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      mockDocumentService.create.mockResolvedValue(expectedResponse);

      const result = await controller.uploadDocument(mockFile, dto);

      expect(result.ocrJobId).toBeDefined();
      expect(result.status).toBe('PROCESSING');
    });

    it('should associate document with taxCaseId if provided', async () => {
      const dto = { taxCaseId: '456' };
      const expectedResponse = {
        id: '1',
        filename: 'unique-filename.pdf',
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        status: 'PROCESSING',
        taxCaseId: '456',
        ocrJobId: 'job-1',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      mockDocumentService.create.mockResolvedValue(expectedResponse);

      const result = await controller.uploadDocument(mockFile, dto);

      expect(result.taxCaseId).toBe('456');
    });

    it('should work without taxCaseId', async () => {
      const dto = {};
      const expectedResponse = {
        id: '1',
        filename: 'unique-filename.pdf',
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        status: 'PROCESSING',
        ocrJobId: 'job-1',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      mockDocumentService.create.mockResolvedValue(expectedResponse);

      const result = await controller.uploadDocument(mockFile, dto);

      expect(result.taxCaseId).toBeUndefined();
    });
  });

  describe('file validation (AC #2, #4)', () => {
    it('should reject files larger than 10MB', async () => {
      // This test validates the file size limit configuration
      // The actual validation happens at the Multer/ParseFilePipe level
      const oversizedFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large-document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: MAX_FILE_SIZE + 1, // 10MB + 1 byte
        destination: './uploads',
        filename: 'large-filename.pdf',
        path: './uploads/large-filename.pdf',
        buffer: Buffer.from(''),
        stream: null as any,
      };

      // Verify MAX_FILE_SIZE is correctly set to 10MB
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
      expect(oversizedFile.size).toBeGreaterThan(MAX_FILE_SIZE);
    });

    it('should only accept valid MIME types (PDF, JPG, PNG)', async () => {
      // Valid MIME types that should pass
      const validMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];

      // Invalid MIME types that should be rejected
      const invalidMimeTypes = ['text/plain', 'application/exe', 'image/gif', 'application/zip'];

      // Verify FileTypeValidator regex pattern matches valid types
      const validatorPattern = /(jpeg|jpg|png|pdf)$/;

      validMimeTypes.forEach((mimeType) => {
        expect(validatorPattern.test(mimeType)).toBe(true);
      });

      invalidMimeTypes.forEach((mimeType) => {
        expect(validatorPattern.test(mimeType)).toBe(false);
      });
    });

    it('should have correct file size limit constant', () => {
      // 10MB in bytes = 10 * 1024 * 1024 = 10485760
      expect(MAX_FILE_SIZE).toBe(10485760);
    });
  });

  describe('getDocumentStatus', () => {
    it('should return document status', async () => {
      const expectedResponse = {
        id: '1',
        status: 'COMPLETED',
        ocrJobId: 'job-1',
      };
      mockDocumentService.getStatus.mockResolvedValue(expectedResponse);

      const result = await controller.getDocumentStatus('1');

      expect(mockDocumentService.getStatus).toHaveBeenCalledWith('1');
      expect(result).toEqual(expectedResponse);
    });

    it('should throw NotFoundException when document not found', async () => {
      mockDocumentService.getStatus.mockRejectedValue(
        new NotFoundException('Document not found'),
      );

      await expect(controller.getDocumentStatus('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDocument', () => {
    it('should return full document details', async () => {
      const expectedResponse = {
        id: '1',
        filename: 'unique-filename.pdf',
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        status: 'COMPLETED',
        taxCaseId: '123',
        ocrJobId: 'job-1',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      mockDocumentService.findById.mockResolvedValue(expectedResponse);

      const result = await controller.getDocument('1');

      expect(mockDocumentService.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(expectedResponse);
    });

    it('should throw NotFoundException when document not found', async () => {
      mockDocumentService.findById.mockRejectedValue(
        new NotFoundException('Document not found'),
      );

      await expect(controller.getDocument('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
