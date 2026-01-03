# PaddleOCR 기술 연구 보고서: 인도네시아 세금 문서 처리를 위한 통합 분석

**작성일**: 2026년 1월 3일
**프로젝트**: AI Pajak - AI 기반 인도네시아 세금 관리 플랫폼
**연구 목적**: PaddleOCR을 활용한 인도네시아 세금 문서 OCR 처리 기술 검토

---

## 목차

1. [Executive Summary (요약)](#1-executive-summary-요약)
2. [PaddleOCR 개요](#2-paddleocr-개요)
3. [인도네시아어 지원 분석](#3-인도네시아어-지원-분석)
4. [세금 문서 처리 요구사항](#4-세금-문서-처리-요구사항)
5. [배포 아키텍처](#5-배포-아키텍처)
6. [NestJS 통합 패턴](#6-nestjs-통합-패턴)
7. [성능 고려사항](#7-성능-고려사항)
8. [대안 솔루션 비교](#8-대안-솔루션-비교)
9. [권장 구현 방안](#9-권장-구현-방안)
10. [참고 자료](#10-참고-자료)

---

## 1. Executive Summary (요약)

### 연구 결론

PaddleOCR은 AI Pajak 플랫폼의 인도네시아 세금 문서 처리에 **적합한 솔루션**으로 평가됩니다. 주요 장점은 다음과 같습니다:

| 항목 | 평가 | 비고 |
|------|------|------|
| 인도네시아어 지원 | **양호** | 라틴 문자 기반, 100개 이상 언어 지원 |
| 문서 구조 분석 | **우수** | PP-StructureV3로 테이블/양식 추출 가능 |
| 배포 유연성 | **우수** | Docker, API 서비스, 온프레미스 지원 |
| 비용 효율성 | **우수** | 오픈소스, 페이지당 비용 없음 |
| 정확도 | **양호~우수** | PP-OCRv5에서 13% 정확도 향상 |
| NestJS 통합 | **가능** | REST API 또는 gRPC 마이크로서비스로 통합 |

### 권장 사항

1. **PP-OCRv5 + PP-StructureV3** 조합 사용 권장
2. **Docker 기반 마이크로서비스**로 NestJS 백엔드와 분리 배포
3. 인도네시아 세금 문서 특화 **파인튜닝** 검토
4. **비동기 처리** 아키텍처 적용 (RabbitMQ/Kafka)

---

## 2. PaddleOCR 개요

### 2.1 아키텍처

PaddleOCR은 Baidu의 PaddlePaddle 프레임워크 기반의 오픈소스 OCR 툴킷입니다. 2025년 6월 기준 GitHub에서 **50,000개 이상의 스타**를 보유하고 있으며, MinerU, RAGFlow, UmiOCR 등 주요 프로젝트에서 핵심 OCR 엔진으로 사용됩니다.

```
PaddleOCR 3.0 구성요소
├── PP-OCRv5 (다국어 텍스트 인식)
│   ├── Text Detection (텍스트 영역 탐지)
│   ├── Text Recognition (문자 인식)
│   └── Direction Classification (텍스트 방향 분류)
├── PP-StructureV3 (문서 구조 분석)
│   ├── Layout Analysis (레이아웃 분석)
│   ├── Table Recognition (테이블 인식)
│   └── Key Information Extraction (핵심 정보 추출)
└── PP-ChatOCRv4 (LLM 연동 정보 추출)
    └── ERNIE 4.5 통합
```

### 2.2 버전 히스토리

| 버전 | 출시일 | 주요 개선 |
|------|--------|----------|
| PP-OCRv3 | 2022 | SVTR + LCNet 모델, 다국어 5% 정확도 향상 |
| PP-OCRv4 | 2023.08 | 중국어 4.5%, 영어 10%, 다국어 8% 정확도 향상 |
| PP-OCRv5 | 2025.05 | PP-OCRv4 대비 **13포인트 정확도 향상** |
| PaddleOCR-VL | 2025.10 | 0.9B 파라미터 VLM, 109개 언어 지원 |

### 2.3 핵심 기능

**텍스트 인식 (PP-OCRv5)**
- 100개 이상 언어 지원 (라틴, 키릴, 아랍, 데바나가리, 태국어 등)
- 경량 모델: 영어 약 2MB, 중국어 약 3.5MB
- 모바일/엣지 디바이스 배포 가능

**문서 구조 분석 (PP-StructureV3)**
- 레이아웃 분석: 제목, 단락, 테이블, 이미지 영역 탐지
- 테이블 인식: 행, 열, 셀 경계 추출
- Markdown/JSON 형식 출력

**핵심 정보 추출 (PP-ChatOCRv4)**
- Semantic Entity Recognition (SER)
- Relationship Extraction (RE)
- LLM 연동 구조화된 데이터 추출

```python
# PP-ChatOCRv4 출력 예시
{
    "invoice_number": "INV-123",
    "total_amount": 199.99,
    "vendor_name": "PT Example Indonesia"
}
```

---

## 3. 인도네시아어 지원 분석

### 3.1 언어 특성

인도네시아어(Bahasa Indonesia)는 **라틴 문자** 기반 언어로, PaddleOCR의 라틴 문자 모델을 활용할 수 있습니다.

| 특성 | 설명 |
|------|------|
| 문자 체계 | 라틴 알파벳 (A-Z) |
| 특수 문자 | 없음 (악센트 등 불필요) |
| 숫자 형식 | 아라비아 숫자 (0-9) |
| 통화 형식 | Rp 1.000.000 (점으로 천 단위 구분) |
| 날짜 형식 | DD/MM/YYYY 또는 DD-MM-YYYY |

### 3.2 지원 현황

PaddleOCR은 인도네시아어를 공식 지원합니다:

- **PP-OCRv5**: 100개 이상 언어 중 라틴 문자 계열로 포함
- **PaddleOCR-VL**: 109개 언어 지원, 인도네시아어 포함

### 3.3 알려진 이슈

GitHub Discussion에서 보고된 사항:
- 커스텀 인도네시아어 데이터셋으로 파인튜닝 시, 언어가 영어로 감지되는 경우 발생
- 해결책: `lang` 파라미터를 명시적으로 설정하거나 라틴 문자 모델 사용

```python
from paddleocr import PaddleOCR

# 인도네시아어 문서 처리 설정
ocr = PaddleOCR(
    use_angle_cls=True,
    lang='latin',  # 라틴 문자 모델 사용
    show_log=False
)
```

### 3.4 파인튜닝 권장사항

인도네시아 세금 문서의 특수 용어와 형식에 대한 정확도 향상을 위해:

1. **데이터셋 수집**: Faktur Pajak, Bukti Potong, SPT 양식 샘플
2. **어노테이션**: 텍스트 영역 및 내용 라벨링
3. **파인튜닝**: PP-OCRv5 인식 모델 재학습

---

## 4. 세금 문서 처리 요구사항

### 4.1 대상 문서 유형

AI Pajak에서 처리해야 할 인도네시아 세금 문서:

#### 4.1.1 Faktur Pajak (세금계산서)

**개요**: 부가가치세(VAT) 신고를 위한 전자 세금계산서

| 필드 | 설명 | OCR 추출 난이도 |
|------|------|----------------|
| NSFP (Nomor Seri Faktur Pajak) | 세금계산서 일련번호 | 중 |
| NPWP Penjual | 판매자 납세자번호 | 중 |
| NPWP Pembeli | 구매자 납세자번호 | 중 |
| Tanggal | 거래일자 | 하 |
| DPP (Dasar Pengenaan Pajak) | 과세표준 | 중 |
| PPN | 부가가치세액 | 중 |
| QR Code | 검증 코드 | 별도 처리 필요 |

**문서 특성**:
- XML 형식의 전자문서가 원본
- PDF 또는 인쇄물로 제공되는 경우 OCR 필요
- QR 코드 포함 (DGT 검증용)
- 2016년 7월부터 VAT 등록 사업자 의무 사용

#### 4.1.2 Bukti Potong (원천징수 증명서)

**개요**: 소득에 대한 원천징수 증명 문서

| 양식 | 용도 | 필드 특성 |
|------|------|----------|
| 1721-A1 | 정규직 직원용 | 표준 양식, 정형화 |
| 1721-A2 | 공무원/군인용 | 표준 양식, 정형화 |
| PPh 21 Bulanan | 월별 원천징수 | 정형화된 테이블 |

**추출 필드**:
- 납세자 이름 및 NPWP
- 과세 기간 (MM 형식)
- 총 소득액
- 원천징수액
- 서명자 정보

#### 4.1.3 SPT (세금신고서)

**개요**: 연간/월간 세금 신고 양식

**디지털화 현황**:
- **CoreTax 시스템**: 2025년 1월부터 DJP Online에서 Coretax DJP로 전환
- XML 형식 데이터 임포트 지원 (기존 CSV 대체)
- 온라인 신고가 기본이나, 스캔 문서 처리 필요 케이스 존재

### 4.2 OCR 처리 요구사항

```
문서 처리 파이프라인
┌─────────────────────────────────────────────────────────────┐
│                    입력 문서                                │
│  (PDF, 이미지, 스캔본)                                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               전처리 (Pre-processing)                       │
│  - 이미지 품질 향상                                         │
│  - 노이즈 제거                                              │
│  - 기울기 보정                                              │
│  - QR 코드 영역 분리                                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               레이아웃 분석 (PP-StructureV3)                │
│  - 문서 유형 식별                                           │
│  - 테이블/양식 영역 탐지                                    │
│  - 텍스트 블록 분할                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               텍스트 인식 (PP-OCRv5)                        │
│  - 문자 인식                                                │
│  - 숫자/통화 형식 처리                                      │
│  - 신뢰도 점수 산출                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               정보 추출 (PP-ChatOCRv4)                      │
│  - 필드별 매핑                                              │
│  - 구조화된 JSON 출력                                       │
│  - 검증 규칙 적용                                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    출력 데이터                              │
│  {                                                          │
│    "document_type": "FAKTUR_PAJAK",                         │
│    "nsfp": "010.000-25.12345678",                          │
│    "npwp_seller": "01.234.567.8-901.000",                  │
│    "amount": 10000000,                                      │
│    "vat": 1100000,                                          │
│    "confidence_score": 0.95                                 │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 QR 코드 처리

Faktur Pajak의 QR 코드는 별도 라이브러리로 처리:

```python
import cv2
from pyzbar import pyzbar

def extract_qr_code(image_path):
    image = cv2.imread(image_path)
    qr_codes = pyzbar.decode(image)

    for qr in qr_codes:
        qr_data = qr.data.decode('utf-8')
        return qr_data
    return None
```

---

## 5. 배포 아키텍처

### 5.1 배포 옵션 비교

| 옵션 | 장점 | 단점 | 권장 사용 케이스 |
|------|------|------|-----------------|
| Docker 컨테이너 | 일관된 환경, 쉬운 배포 | 이미지 크기 | 프로덕션 |
| Kubernetes | 자동 스케일링, 고가용성 | 복잡한 설정 | 대규모 서비스 |
| 로컬 Python 패키지 | 간단한 설정 | 환경 의존성 | 개발/테스트 |
| Cloud AI 서비스 | 관리 불필요 | 비용, 데이터 외부 전송 | 소규모/MVP |

### 5.2 권장 Docker 아키텍처

```yaml
# docker-compose.yml
version: '3.8'

services:
  paddleocr-api:
    image: paddleocr-api:latest
    build:
      context: ./ocr-service
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - OCR_LANG=latin
      - ENABLE_STRUCTURE=true
    volumes:
      - ./models:/app/models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=ocr
      - RABBITMQ_DEFAULT_PASS=secret

volumes:
  redis-data:
```

### 5.3 Dockerfile 예시

```dockerfile
# Dockerfile
FROM paddlepaddle/paddle:3.0.0-gpu-cuda12.3-cudnn9.0-trt10.6

WORKDIR /app

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# PaddleOCR 설치
RUN pip install paddleocr

# 애플리케이션 코드 복사
COPY . .

# 모델 사전 다운로드
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='latin')"

EXPOSE 8080

CMD ["python", "app.py"]
```

### 5.4 OCR 마이크로서비스 API 설계

```python
# app.py - FastAPI 기반 OCR 서비스
from fastapi import FastAPI, UploadFile, File, HTTPException
from paddleocr import PaddleOCR
from typing import List, Dict, Any
import tempfile
import os

app = FastAPI(title="PaddleOCR Service", version="1.0.0")

# OCR 엔진 초기화
ocr_engine = PaddleOCR(
    use_angle_cls=True,
    lang='latin',
    use_gpu=True,
    show_log=False
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "engine": "paddleocr"}

@app.post("/ocr/text")
async def extract_text(file: UploadFile = File(...)) -> Dict[str, Any]:
    """이미지에서 텍스트 추출"""
    try:
        # 임시 파일 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # OCR 실행
        result = ocr_engine.ocr(tmp_path, cls=True)

        # 결과 파싱
        extracted_texts = []
        for line in result[0]:
            box, (text, confidence) = line
            extracted_texts.append({
                "text": text,
                "confidence": float(confidence),
                "bounding_box": box
            })

        # 임시 파일 삭제
        os.unlink(tmp_path)

        return {
            "success": True,
            "data": extracted_texts,
            "total_items": len(extracted_texts)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ocr/structure")
async def extract_structure(file: UploadFile = File(...)) -> Dict[str, Any]:
    """문서 구조 및 테이블 추출"""
    # PP-StructureV3 로직 구현
    pass

@app.post("/ocr/invoice")
async def extract_invoice(file: UploadFile = File(...)) -> Dict[str, Any]:
    """세금계산서 정보 추출"""
    # Faktur Pajak 특화 추출 로직
    pass
```

### 5.5 GPU 요구사항

| 환경 | 권장 사양 | 메모리 |
|------|----------|--------|
| 개발 | NVIDIA GTX 1060 이상 | 6GB VRAM |
| 프로덕션 (소규모) | NVIDIA Tesla T4 | 16GB VRAM |
| 프로덕션 (대규모) | NVIDIA A10/A100 | 40GB+ VRAM |
| CPU Only | 8코어 이상 | 16GB RAM |

**메모리 사용량**: 처리 후 약 1.5GB에서 안정화. 저메모리 환경에서는 `--cpu_mem=1200` 파라미터로 메모리 정리 트리거 가능.

---

## 6. NestJS 통합 패턴

### 6.1 아키텍처 개요

```
AI Pajak 시스템 아키텍처
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│                    apps/web (port 5173)                     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway (NestJS)                      │
│                    apps/api (port 3000)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  TaxCase    │  │   Filing    │  │   Company   │        │
│  │  Module     │  │   Module    │  │   Module    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│              ┌───────────┴───────────┐                     │
│              │    OCR Module         │                     │
│              │  (HTTP Client)        │                     │
│              └───────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   RabbitMQ      │ │   Redis         │ │   PostgreSQL    │
│   (Queue)       │ │   (Cache)       │ │   (Database)    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                  OCR Microservice                           │
│               (PaddleOCR + FastAPI)                         │
│                    (port 8080)                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 NestJS OCR 모듈 구현

#### 6.2.1 모듈 구조

```
apps/api/src/ocr/
├── ocr.module.ts
├── ocr.controller.ts
├── ocr.service.ts
├── dto/
│   ├── ocr-request.dto.ts
│   └── ocr-response.dto.ts
├── interfaces/
│   └── ocr-result.interface.ts
└── clients/
    └── paddleocr.client.ts
```

#### 6.2.2 OCR 서비스 구현

```typescript
// ocr.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { PaddleOcrClient } from './clients/paddleocr.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 5,
    }),
    BullModule.registerQueue({
      name: 'ocr-processing',
    }),
  ],
  controllers: [OcrController],
  providers: [OcrService, PaddleOcrClient],
  exports: [OcrService],
})
export class OcrModule {}
```

```typescript
// ocr.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PaddleOcrClient } from './clients/paddleocr.client';
import { OcrResult, InvoiceData } from './interfaces/ocr-result.interface';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly paddleOcrClient: PaddleOcrClient,
    @InjectQueue('ocr-processing') private readonly ocrQueue: Queue,
  ) {}

  /**
   * 동기 방식 OCR 처리 (작은 파일용)
   */
  async extractTextSync(file: Express.Multer.File): Promise<OcrResult> {
    this.logger.log(`Processing file: ${file.originalname}`);

    const result = await this.paddleOcrClient.extractText(file.buffer);

    return {
      success: true,
      texts: result.data,
      totalItems: result.total_items,
      processingTime: result.processing_time,
    };
  }

  /**
   * 비동기 방식 OCR 처리 (큰 파일 또는 배치용)
   */
  async extractTextAsync(
    file: Express.Multer.File,
    callbackUrl?: string,
  ): Promise<{ jobId: string }> {
    const job = await this.ocrQueue.add('extract-text', {
      fileBuffer: file.buffer.toString('base64'),
      fileName: file.originalname,
      callbackUrl,
    });

    return { jobId: job.id.toString() };
  }

  /**
   * Faktur Pajak (세금계산서) 추출
   */
  async extractFakturPajak(file: Express.Multer.File): Promise<InvoiceData> {
    const ocrResult = await this.paddleOcrClient.extractInvoice(file.buffer);

    return this.parseFakturPajak(ocrResult);
  }

  /**
   * Bukti Potong (원천징수 증명서) 추출
   */
  async extractBuktiPotong(file: Express.Multer.File): Promise<any> {
    const ocrResult = await this.paddleOcrClient.extractStructure(file.buffer);

    return this.parseBuktiPotong(ocrResult);
  }

  private parseFakturPajak(ocrResult: any): InvoiceData {
    // Faktur Pajak 필드 매핑 로직
    const texts = ocrResult.data.map((item: any) => item.text).join(' ');

    return {
      documentType: 'FAKTUR_PAJAK',
      nsfp: this.extractField(texts, /(\d{3}\.\d{3}-\d{2}\.\d{8})/),
      npwpSeller: this.extractField(texts, /NPWP\s*:?\s*(\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3})/i),
      npwpBuyer: this.extractField(texts, /Pembeli.*NPWP\s*:?\s*(\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3})/is),
      taxableAmount: this.extractAmount(texts, /DPP\s*:?\s*Rp?\s*([\d.,]+)/i),
      vatAmount: this.extractAmount(texts, /PPN\s*:?\s*Rp?\s*([\d.,]+)/i),
      date: this.extractDate(texts),
      confidence: ocrResult.confidence || 0.9,
    };
  }

  private extractField(text: string, pattern: RegExp): string | null {
    const match = text.match(pattern);
    return match ? match[1] : null;
  }

  private extractAmount(text: string, pattern: RegExp): number | null {
    const match = text.match(pattern);
    if (!match) return null;

    // 인도네시아 숫자 형식 변환 (1.000.000 -> 1000000)
    const amountStr = match[1].replace(/\./g, '').replace(',', '.');
    return parseFloat(amountStr);
  }

  private extractDate(text: string): string | null {
    // DD/MM/YYYY 또는 DD-MM-YYYY 형식
    const match = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    return match ? match[1] : null;
  }

  private parseBuktiPotong(ocrResult: any): any {
    // Bukti Potong 파싱 로직
    return {};
  }
}
```

```typescript
// clients/paddleocr.client.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';

@Injectable()
export class PaddleOcrClient {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'OCR_SERVICE_URL',
      'http://localhost:8080',
    );
  }

  async extractText(fileBuffer: Buffer): Promise<any> {
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: 'document.png',
      contentType: 'image/png',
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/ocr/text`, formData, {
          headers: formData.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'OCR service error',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async extractStructure(fileBuffer: Buffer): Promise<any> {
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: 'document.png',
      contentType: 'image/png',
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/ocr/structure`, formData, {
          headers: formData.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'OCR structure extraction error',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async extractInvoice(fileBuffer: Buffer): Promise<any> {
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: 'invoice.png',
      contentType: 'image/png',
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/ocr/invoice`, formData, {
          headers: formData.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Invoice extraction error',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/health`),
      );
      return response.data.status === 'healthy';
    } catch {
      return false;
    }
  }
}
```

#### 6.2.3 컨트롤러 구현

```typescript
// ocr.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { OcrService } from './ocr.service';

@ApiTags('OCR')
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('extract-text')
  @ApiOperation({ summary: '이미지에서 텍스트 추출' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async extractText(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.ocrService.extractTextSync(file);
  }

  @Post('extract-faktur-pajak')
  @ApiOperation({ summary: 'Faktur Pajak (세금계산서) 정보 추출' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async extractFakturPajak(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.ocrService.extractFakturPajak(file);
  }

  @Post('extract-bukti-potong')
  @ApiOperation({ summary: 'Bukti Potong (원천징수 증명서) 정보 추출' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async extractBuktiPotong(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.ocrService.extractBuktiPotong(file);
  }

  @Post('async/extract-text')
  @ApiOperation({ summary: '비동기 텍스트 추출 (큰 파일용)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async extractTextAsync(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.ocrService.extractTextAsync(file);
  }

  @Get('job/:jobId')
  @ApiOperation({ summary: '비동기 작업 상태 조회' })
  async getJobStatus(@Param('jobId') jobId: string) {
    // 작업 상태 조회 로직
    return { jobId, status: 'processing' };
  }
}
```

### 6.3 비동기 처리 (Bull Queue)

```typescript
// ocr.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PaddleOcrClient } from './clients/paddleocr.client';

@Processor('ocr-processing')
export class OcrProcessor {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(private readonly paddleOcrClient: PaddleOcrClient) {}

  @Process('extract-text')
  async handleExtractText(job: Job) {
    this.logger.log(`Processing job ${job.id}`);

    const { fileBuffer, fileName, callbackUrl } = job.data;
    const buffer = Buffer.from(fileBuffer, 'base64');

    try {
      const result = await this.paddleOcrClient.extractText(buffer);

      // 콜백 URL이 있으면 결과 전송
      if (callbackUrl) {
        await this.sendCallback(callbackUrl, {
          jobId: job.id,
          status: 'completed',
          result,
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }

  private async sendCallback(url: string, data: any): Promise<void> {
    // HTTP POST로 콜백 전송
  }
}
```

### 6.4 TaxCase 모듈 통합

기존 AI Pajak의 TaxCase 워크플로우와 OCR 통합:

```typescript
// taxcase/taxcase.service.ts (확장)
import { OcrService } from '../ocr/ocr.service';

@Injectable()
export class TaxCaseService {
  constructor(
    private readonly taxCaseRepository: TaxCaseRepository,
    private readonly ocrService: OcrService,
  ) {}

  async processUploadedDocument(
    taxCaseId: bigint,
    file: Express.Multer.File,
  ): Promise<void> {
    // 1. 문서 유형 감지
    const documentType = this.detectDocumentType(file);

    // 2. OCR 처리
    let extractedData;
    switch (documentType) {
      case 'FAKTUR_PAJAK':
        extractedData = await this.ocrService.extractFakturPajak(file);
        break;
      case 'BUKTI_POTONG':
        extractedData = await this.ocrService.extractBuktiPotong(file);
        break;
      default:
        extractedData = await this.ocrService.extractTextSync(file);
    }

    // 3. TaxCase 업데이트 (UPLOADED -> AI_ANALYZED)
    await this.taxCaseRepository.updateWithOcrResult(taxCaseId, {
      ocrResult: extractedData,
      stage: 'AI_ANALYZED',
    });
  }

  private detectDocumentType(file: Express.Multer.File): string {
    // 파일명 또는 메타데이터 기반 문서 유형 감지
    const fileName = file.originalname.toLowerCase();

    if (fileName.includes('faktur') || fileName.includes('invoice')) {
      return 'FAKTUR_PAJAK';
    }
    if (fileName.includes('potong') || fileName.includes('1721')) {
      return 'BUKTI_POTONG';
    }
    return 'UNKNOWN';
  }
}
```

---

## 7. 성능 고려사항

### 7.1 벤치마크 데이터

| 지표 | PaddleOCR (GPU) | PaddleOCR (CPU) | Tesseract |
|------|-----------------|-----------------|-----------|
| 평균 처리 시간/이미지 | 2.07초 | 5-8초 | 3.8초 |
| 모델 크기 (영어) | ~2MB | ~2MB | ~23MB |
| GPU 메모리 | 1.5GB (안정화 후) | N/A | N/A |
| 정확도 (인쇄물) | 95%+ | 95%+ | 85-90% |
| 복잡한 레이아웃 | 우수 | 우수 | 보통 |

### 7.2 최적화 전략

#### 7.2.1 모델 최적화

```python
# 경량 모델 사용
from paddleocr import PaddleOCR

# 모바일/엣지용 경량 모델
ocr_light = PaddleOCR(
    det_model_dir='./models/det_mobile',
    rec_model_dir='./models/rec_mobile',
    use_gpu=False,
    enable_mkldnn=True,  # Intel MKL-DNN 가속
)

# 서버용 고정밀 모델
ocr_server = PaddleOCR(
    det_model_dir='./models/det_server',
    rec_model_dir='./models/rec_server',
    use_gpu=True,
    precision='fp16',  # 반정밀도로 속도 향상
)
```

#### 7.2.2 배치 처리

```python
from paddleocr import PaddleOCR
from concurrent.futures import ThreadPoolExecutor
import asyncio

class BatchOcrProcessor:
    def __init__(self, max_workers=4):
        self.ocr = PaddleOCR(use_gpu=True, show_log=False)
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

    async def process_batch(self, image_paths: list) -> list:
        loop = asyncio.get_event_loop()
        tasks = [
            loop.run_in_executor(self.executor, self.ocr.ocr, path)
            for path in image_paths
        ]
        return await asyncio.gather(*tasks)
```

#### 7.2.3 캐싱 전략

```typescript
// Redis 기반 OCR 결과 캐싱
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import * as crypto from 'crypto';

@Injectable()
export class OcrService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async extractTextWithCache(file: Express.Multer.File): Promise<OcrResult> {
    // 파일 해시로 캐시 키 생성
    const fileHash = crypto
      .createHash('md5')
      .update(file.buffer)
      .digest('hex');

    const cacheKey = `ocr:${fileHash}`;

    // 캐시 확인
    const cached = await this.cacheManager.get<OcrResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // OCR 처리
    const result = await this.extractTextSync(file);

    // 캐시 저장 (1시간)
    await this.cacheManager.set(cacheKey, result, 3600);

    return result;
  }
}
```

### 7.3 스케일링 고려사항

#### 7.3.1 수평 확장

```yaml
# kubernetes/ocr-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: paddleocr-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: paddleocr
  template:
    metadata:
      labels:
        app: paddleocr
    spec:
      containers:
      - name: paddleocr
        image: paddleocr-api:latest
        resources:
          requests:
            memory: "2Gi"
            nvidia.com/gpu: 1
          limits:
            memory: "4Gi"
            nvidia.com/gpu: 1
        ports:
        - containerPort: 8080
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: paddleocr-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: paddleocr-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

#### 7.3.2 로드 밸런싱

```yaml
# kubernetes/ocr-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: paddleocr-service
spec:
  type: ClusterIP
  selector:
    app: paddleocr
  ports:
  - port: 8080
    targetPort: 8080
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: paddleocr-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "120"
spec:
  rules:
  - host: ocr.aipajak.internal
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: paddleocr-service
            port:
              number: 8080
```

---

## 8. 대안 솔루션 비교

### 8.1 종합 비교표

| 솔루션 | 정확도 | 속도 | 비용 | 인도네시아어 | 테이블 추출 | 배포 유연성 |
|--------|--------|------|------|-------------|-------------|-------------|
| **PaddleOCR** | 95%+ | 빠름 | 무료 | 양호 | 우수 | 높음 |
| Tesseract | 85-90% | 보통 | 무료 | 양호 | 제한적 | 높음 |
| Google Vision | 98%+ | 빠름 | 유료 | 우수 | 우수 | 클라우드 |
| AWS Textract | 98%+ | 빠름 | 유료 | 양호 | 우수 | 클라우드 |
| Azure Document Intelligence | 98%+ | 빠름 | 유료 | 우수 | 우수 | 클라우드 |

### 8.2 상세 분석

#### 8.2.1 Tesseract OCR

**장점**:
- 완전 오픈소스, 무료
- 간단한 통합
- 오프라인 작동
- 광범위한 언어 지원

**단점**:
- 복잡한 레이아웃에 취약
- 테이블 추출 제한적
- 전처리 필요
- 노이즈에 민감

**인도네시아어 지원**: 라틴 문자 기반으로 양호

**적합 케이스**: 간단한 텍스트 추출, 학술 프로젝트, 리소스 제한 환경

#### 8.2.2 Google Cloud Vision

**장점**:
- 최고 수준 정확도
- 100개 이상 언어 지원
- 손글씨 인식 지원
- 관리 불필요

**단점**:
- 페이지당 비용 발생 ($1.50/1,000 pages)
- 데이터 외부 전송
- 인터넷 연결 필요
- 커스터마이징 제한

**비용**: 기본 텍스트 추출 $1,500/백만 페이지, 구조화 추출 $10,000-$50,000/백만 페이지

**적합 케이스**: 정확도 최우선, 빠른 구현, 소규모 처리량

#### 8.2.3 AWS Textract

**장점**:
- 우수한 스캔 문서 처리
- 양식/테이블 추출 강점
- AWS 생태계 통합
- 쿼리 기반 추출 지원

**단점**:
- 비용 (기본 $1.50/page, 테이블/양식 $15/page)
- AWS 종속
- 이미지 품질에 민감
- 커스터마이징 제한

**적합 케이스**: 송장/영수증/의료 양식 처리, AWS 인프라 사용 조직

#### 8.2.4 Azure Document Intelligence

**장점**:
- 커스텀 모델 훈련 지원
- 다양한 문서 유형 지원
- 높은 정확도
- Azure 생태계 통합

**단점**:
- 비용
- Azure 종속
- 복잡한 설정

**적합 케이스**: 커스텀 문서 유형, Microsoft 생태계 사용 조직

### 8.3 비용 분석 (월간 10,000 페이지 기준)

| 솔루션 | 월간 비용 (USD) | 비고 |
|--------|----------------|------|
| PaddleOCR (자체 호스팅) | ~$50-100 | 서버 비용만 |
| Tesseract (자체 호스팅) | ~$50-100 | 서버 비용만 |
| Google Cloud Vision | ~$15 | 기본 텍스트만 |
| AWS Textract | ~$15-150 | 기능에 따라 |
| Azure Document Intelligence | ~$15-150 | 기능에 따라 |

### 8.4 AI Pajak에 대한 권장 사항

**1순위: PaddleOCR (권장)**
- 이유: 비용 효율성, 데이터 프라이버시, 높은 정확도, 테이블 추출 지원
- 고려사항: 인도네시아 세금 문서 파인튜닝 필요

**2순위: Google Cloud Vision (대안)**
- 이유: 빠른 구현, 최고 정확도
- 고려사항: 비용, 데이터 외부 전송 이슈

**하이브리드 접근**:
- 일반 문서: PaddleOCR
- 복잡한/중요한 문서: Cloud Vision API (폴백)

---

## 9. 권장 구현 방안

### 9.1 단계별 구현 계획

```
Phase 1: 기초 구축 (2-3주)
├── PaddleOCR Docker 서비스 구축
├── 기본 REST API 구현
├── NestJS OCR 모듈 개발
└── 단위 테스트

Phase 2: 문서 특화 개발 (3-4주)
├── Faktur Pajak 파서 개발
├── Bukti Potong 파서 개발
├── QR 코드 처리 통합
├── 검증 로직 구현
└── 통합 테스트

Phase 3: 최적화 (2-3주)
├── 성능 튜닝
├── 인도네시아어 파인튜닝 (선택)
├── 캐싱 구현
├── 모니터링 설정
└── 부하 테스트

Phase 4: 프로덕션 배포 (1-2주)
├── Kubernetes 배포
├── CI/CD 파이프라인
├── 문서화
└── 운영 모니터링
```

### 9.2 기술 스택 권장

```
OCR 서비스 스택
├── OCR 엔진: PaddleOCR 3.0 (PP-OCRv5 + PP-StructureV3)
├── 서비스 프레임워크: FastAPI (Python)
├── 컨테이너: Docker + NVIDIA Container Toolkit
├── 오케스트레이션: Kubernetes
└── GPU: NVIDIA T4 또는 A10

AI Pajak 백엔드 통합
├── 프레임워크: NestJS
├── 통신: HTTP (REST API)
├── 비동기 처리: Bull Queue + Redis
├── 캐싱: Redis
└── 메시지 브로커: RabbitMQ (선택)
```

### 9.3 모니터링 및 로깅

```typescript
// 모니터링 메트릭
const ocrMetrics = {
  // 처리량
  'ocr.requests.total': Counter,
  'ocr.requests.success': Counter,
  'ocr.requests.failure': Counter,

  // 지연 시간
  'ocr.processing.duration': Histogram,

  // 정확도
  'ocr.confidence.average': Gauge,

  // 리소스
  'ocr.gpu.memory.used': Gauge,
  'ocr.queue.length': Gauge,
};
```

### 9.4 보안 고려사항

AI Pajak의 법적 요구사항에 따른 보안 구현:

1. **데이터 격리**: OCR 서비스는 세금 데이터에 직접 접근 불가
2. **전송 암호화**: TLS 1.3 적용
3. **저장 암호화**: 임시 파일 암호화
4. **감사 로깅**: 모든 OCR 요청 로깅
5. **접근 제어**: API 키 또는 JWT 인증

```typescript
// OCR 요청 감사 로깅
@Injectable()
export class OcrAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (response) => {
        await this.auditLogRepository.create({
          action: 'OCR_PROCESS',
          userId: request.user?.id,
          documentType: response?.documentType,
          processingTime: Date.now() - startTime,
          success: true,
          timestamp: new Date(),
        });
      }),
      catchError(async (error) => {
        await this.auditLogRepository.create({
          action: 'OCR_PROCESS',
          userId: request.user?.id,
          error: error.message,
          success: false,
          timestamp: new Date(),
        });
        throw error;
      }),
    );
  }
}
```

---

## 10. 참고 자료

### 공식 문서

1. [PaddleOCR GitHub Repository](https://github.com/PaddlePaddle/PaddleOCR) - 50,000+ stars, 공식 오픈소스 저장소
2. [PaddleOCR Documentation](https://paddlepaddle.github.io/PaddleOCR/) - 공식 문서
3. [PaddleOCR 3.0 Technical Report](https://arxiv.org/html/2507.05595v1) - 기술 보고서
4. [PaddleOCR PyPI](https://pypi.org/project/paddleocr/) - Python 패키지

### 기술 가이드

5. [PaddleOCR Guide 2025: PP-OCRv3, v4, v5 for Developers](https://www.tenorshare.com/ocr/paddleocr.html) - 버전별 가이드
6. [2025 Complete Guide: PaddleOCR-VL-0.9B](https://dev.to/czmilo/2025-complete-guide-paddleocr-vl-09b-baidus-ultra-lightweight-document-parsing-powerhouse-1e8l) - VLM 모델 가이드
7. [PaddlePaddle/PaddleOCR-VL on Hugging Face](https://huggingface.co/PaddlePaddle/PaddleOCR-VL) - VLM 모델 허브

### 비교 및 벤치마크

8. [DeepSeek-OCR vs GPT-4-Vision vs PaddleOCR: 2025 Accuracy Guide](https://skywork.ai/blog/ai-agent/deepseek-ocr-vs-gpt-4-vision-vs-paddleocr-2025-comparison/) - 정확도 비교
9. [7 Best Open-Source OCR Models 2025](https://www.e2enetworks.com/blog/complete-guide-open-source-ocr-models-2025) - 오픈소스 OCR 비교
10. [OCR Ranking 2025 – Pragmile](https://pragmile.com/ocr-ranking-2025-comparison-of-the-best-text-recognition-and-document-structure-software/) - OCR 랭킹

### 인도네시아 세금 문서

11. [e-Faktur Pajak: Electronic Invoicing in Indonesia | EDICOM](https://edicomgroup.com/blog/efaktur-indonesia-electronic-invoicing) - e-Faktur 시스템
12. [e-Invoicing in Indonesia: Guidelines | ClearTax](https://www.cleartax.com/id/en/e-invoicing-indonesia) - 전자 세금계산서 가이드
13. [Indonesia Withholding Tax | PWC](https://taxsummaries.pwc.com/indonesia/corporate/withholding-taxes) - 원천징수세
14. [Withholding Tax Report for Indonesia | Microsoft](https://learn.microsoft.com/en-us/dynamics365/finance/localizations/indonesia/apac-idn-wht-declaration) - WHT 보고서

### NestJS 통합

15. [NestJS Microservices Documentation](https://docs.nestjs.com/microservices/basics) - 공식 마이크로서비스 문서
16. [Building Microservices Architecture with NestJS](https://medium.com/@m.bilal0111/a-beginners-guide-to-building-microservices-architecture-with-nestjs-84e8a41c2c90) - 아키텍처 가이드
17. [API Gateway in NestJS with Microservices](https://makinhs.medium.com/an-introduction-to-api-gateway-in-nestjs-with-microservices-and-rest-apis-part-01-2a1f619b036a) - API 게이트웨이 패턴

### Docker 배포

18. [PaddleOCR Docker Deployment](https://github.com/PaddlePaddle/PaddleOCR/tree/main/deploy/docker) - 공식 Docker 가이드
19. [PaddleOCR-API GitHub](https://github.com/m986883511/PaddleOCR-API) - GPU Docker API 서비스
20. [PaddleOCR-json Docker](https://deepwiki.com/hiroi-sora/PaddleOCR-json/3.3-docker-deployment) - JSON API Docker

---

*이 문서는 AI Pajak 프로젝트의 OCR 기술 선정을 위한 기술 연구 자료입니다.*
*작성: Claude Code Research Agent*
*최종 업데이트: 2026년 1월 3일*
