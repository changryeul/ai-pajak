import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { DocumentService } from './document.service';
import { PrismaService } from '../repository/prisma.service';

describe('DocumentService', () => {
  let service: DocumentService;
  let mockPrismaService: {
    document: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let mockOcrQueue: {
    add: jest.Mock;
  };

  beforeEach(async () => {
    mockPrismaService = {
      document: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    mockOcrQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken('ocr-processing'),
          useValue: mockOcrQueue,
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test-document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024 * 100,
      destination: './uploads',
      filename: 'unique-filename.pdf',
      path: './uploads/unique-filename.pdf',
      buffer: Buffer.from(''),
      stream: null as any,
    };

    it('should create document and queue OCR job', async () => {
      const createdAt = new Date();
      const dto = { taxCaseId: '123' };
      const mockDocument = {
        id: BigInt(1),
        filename: 'unique-filename.pdf',
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        path: './uploads/unique-filename.pdf',
        status: 'PENDING',
        taxCaseId: BigInt(123),
        ocrJobId: null,
        createdAt,
        updatedAt: createdAt,
      };

      mockPrismaService.document.create.mockResolvedValue(mockDocument);
      mockOcrQueue.add.mockResolvedValue({ id: 'job-1' });
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        ocrJobId: 'job-1',
        status: 'PROCESSING',
      });

      const result = await service.create(mockFile, dto);

      expect(mockPrismaService.document.create).toHaveBeenCalledWith({
        data: {
          filename: 'unique-filename.pdf',
          originalName: 'test-document.pdf',
          mimeType: 'application/pdf',
          size: 102400,
          path: './uploads/unique-filename.pdf',
          status: 'PENDING',
          taxCaseId: BigInt(123),
        },
      });
      expect(mockOcrQueue.add).toHaveBeenCalledWith('process', {
        documentId: '1',
        filePath: './uploads/unique-filename.pdf',
        mimeType: 'application/pdf',
      });
      expect(result.status).toBe('PROCESSING');
      expect(result.ocrJobId).toBe('job-1');
    });

    it('should create document without taxCaseId', async () => {
      const createdAt = new Date();
      const dto = {};
      const mockDocument = {
        id: BigInt(1),
        filename: 'unique-filename.pdf',
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        path: './uploads/unique-filename.pdf',
        status: 'PENDING',
        taxCaseId: null,
        ocrJobId: null,
        createdAt,
        updatedAt: createdAt,
      };

      mockPrismaService.document.create.mockResolvedValue(mockDocument);
      mockOcrQueue.add.mockResolvedValue({ id: 'job-1' });
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        ocrJobId: 'job-1',
        status: 'PROCESSING',
      });

      const result = await service.create(mockFile, dto);

      expect(mockPrismaService.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taxCaseId: null,
        }),
      });
      expect(result.taxCaseId).toBeUndefined();
    });
  });

  describe('getStatus', () => {
    it('should return document status', async () => {
      const mockDocument = {
        id: BigInt(1),
        status: 'COMPLETED',
        ocrJobId: 'job-1',
      };
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);

      const result = await service.getStatus('1');

      expect(mockPrismaService.document.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
      });
      expect(result).toEqual({
        id: '1',
        status: 'COMPLETED',
        ocrJobId: 'job-1',
      });
    });

    it('should throw NotFoundException when document not found', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return full document details', async () => {
      const createdAt = new Date();
      const mockDocument = {
        id: BigInt(1),
        filename: 'unique-filename.pdf',
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        path: './uploads/unique-filename.pdf',
        status: 'COMPLETED',
        taxCaseId: BigInt(123),
        ocrJobId: 'job-1',
        createdAt,
        updatedAt: createdAt,
      };
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);

      const result = await service.findById('1');

      expect(result).toEqual({
        id: '1',
        filename: 'unique-filename.pdf',
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        status: 'COMPLETED',
        taxCaseId: '123',
        ocrJobId: 'job-1',
        createdAt: createdAt.toISOString(),
      });
    });

    it('should throw NotFoundException when document not found', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(null);

      await expect(service.findById('999')).rejects.toThrow(NotFoundException);
    });
  });
});
