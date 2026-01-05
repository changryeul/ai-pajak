import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OcrModule } from './ocr.module';
import { PaddleOcrClient } from './paddleocr.client';

describe('OcrModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        OcrModule,
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide PaddleOcrClient', () => {
    const client = module.get<PaddleOcrClient>(PaddleOcrClient);
    expect(client).toBeDefined();
  });

  it('should inject ConfigService into PaddleOcrClient', () => {
    const configService = module.get<ConfigService>(ConfigService);
    expect(configService).toBeDefined();
  });
});
