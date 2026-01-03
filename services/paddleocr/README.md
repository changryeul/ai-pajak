# PaddleOCR Service

OCR processing service using PP-OCRv5 for AI Pajak platform.

## Overview

This service provides REST API endpoints for extracting text from images and PDF documents using PaddlePaddle's PP-OCRv5 model. It supports:

- **Image OCR**: JPEG, PNG format support
- **PDF OCR**: Multi-page PDF processing
- **Table Recognition**: Automatic table detection and cell extraction using PPStructure
- **Multi-language**: English, Indonesian support

## Quick Start

### Using Docker Compose (Recommended)

```bash
# From project root
docker compose up paddleocr -d

# Check service health
curl http://localhost:8080/health
```

### Local Development

```bash
cd services/paddleocr

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

### Docker Build Only

```bash
cd services/paddleocr

# Build image
docker build -t ai-pajak-paddleocr .

# Run container
docker run -d -p 8080:8080 --name paddleocr ai-pajak-paddleocr
```

## API Reference

### `GET /health`

Health check endpoint for Docker/Kubernetes probes.

**Response:**
```json
{
  "status": "healthy",
  "engine": "PADDLEOCR"
}
```

### `GET /info`

Get OCR model information.

**Response:**
```json
{
  "version": "PP-OCRv5",
  "languages": ["en", "id", "ch"],
  "features": ["text_detection", "text_recognition", "textline_orientation"]
}
```

### `POST /ocr/process`

Process image or PDF file with OCR.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` - Image (JPEG/PNG) or PDF file
- Max file size: 10MB

**Response:**
```json
{
  "success": true,
  "processing_time_ms": 1250,
  "results": [
    {
      "text": "Invoice Number: 12345",
      "confidence": 0.95,
      "bbox": [[10, 20], [200, 20], [200, 50], [10, 50]],
      "page": 1
    }
  ],
  "tables": [
    {
      "page": 1,
      "cells": [
        {"row": 0, "col": 0, "text": "Item", "confidence": 0.92},
        {"row": 0, "col": 1, "text": "Price", "confidence": 0.94}
      ],
      "bbox": [[50, 100], [300, 100], [300, 250], [50, 250]],
      "html": "<table>...</table>"
    }
  ],
  "engine": "PADDLEOCR",
  "model_version": "PP-OCRv5"
}
```

**Error Responses:**
- `400 Bad Request`: Unsupported file type
- `413 Payload Too Large`: File exceeds 10MB limit
- `500 Internal Server Error`: OCR processing failed

## Testing

### Using curl

```bash
# Health check
curl http://localhost:8080/health

# Info endpoint
curl http://localhost:8080/info

# Process image
curl -X POST http://localhost:8080/ocr/process \
  -F "file=@path/to/image.jpg"

# Process PDF
curl -X POST http://localhost:8080/ocr/process \
  -F "file=@path/to/document.pdf"
```

### Using test script

```bash
./test.sh                     # Run health/info tests only
./test.sh path/to/image.jpg   # Run all tests with image
```

### Unit tests

```bash
# Install test dependencies
pip install pytest httpx pytest-asyncio

# Run tests
pytest tests/ -v
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (debug, info, warning, error) |
| `PYTHONUNBUFFERED` | `1` | Python output buffering |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Comma-separated allowed CORS origins |

### Performance Tuning

The Dockerfile configures uvicorn with 2 workers for balanced performance:

```dockerfile
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
```

Adjust `--workers` based on available CPU cores and memory:
- 1 worker: ~2GB RAM
- 2 workers: ~4GB RAM (recommended)
- 4 workers: ~8GB RAM

## Integration with NestJS API

```typescript
// apps/api/src/ocr/paddleocr.client.ts
@Injectable()
export class PaddleOcrClient {
  private readonly baseUrl = process.env.PADDLEOCR_SERVICE_URL || 'http://localhost:8080';
  private readonly timeout = 30000; // 30s

  async process(file: Buffer, mimeType: string): Promise<OcrResult> {
    const formData = new FormData();
    formData.append('file', new Blob([file], { type: mimeType }));

    const response = await fetch(`${this.baseUrl}/ocr/process`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new OcrProcessingException(response.statusText);
    }
    return response.json();
  }
}
```

## Architecture

```
services/paddleocr/
├── Dockerfile           # Container configuration
├── requirements.txt     # Python dependencies
├── main.py             # FastAPI application
├── ocr_processor.py    # PaddleOCR wrapper
├── test.sh             # curl test script
├── README.md           # This file
├── models/             # PP-OCRv5 models (auto-downloaded)
│   └── .gitkeep
└── tests/
    ├── test_ocr.py     # Unit tests
    └── samples/        # Test images
        └── .gitkeep
```

## Troubleshooting

### Container fails to start

1. Check if port 8080 is available
2. Verify sufficient memory (minimum 4GB recommended)
3. Check logs: `docker logs ai-pajak-paddleocr`

### Slow first request

The OCR models (~2GB) are loaded on first request if not pre-loaded. The Dockerfile pre-downloads models during build to minimize startup time.

### Out of memory errors

Reduce worker count in Dockerfile or increase container memory limit.

## License

Internal use only - AI Pajak Platform
