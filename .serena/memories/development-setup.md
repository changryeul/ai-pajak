# Development Setup Notes

## PaddleOCR Service
- **Development**: PaddleOCR는 Apple Silicon(ARM64)에서 호환성 문제가 있음
- **문제점**: Segmentation fault, 메모리 할당자 오류 발생
- **상세 문서**: `docs/arm64-paddleocr-problem.md` 참조
- **대안**: 개발 시 Tesseract OCR 사용 권장, 프로덕션은 x86_64 서버에서 PaddleOCR 실행
- **Location**: `services/paddleocr/`
- **Port**: 8080 (default)

## Docker Compose Services (Development)
- `ai-pajak-api`: NestJS API (port 3333)
- `ai-pajak-web`: Vite React frontend (port 8088)
- PaddleOCR은 Apple Silicon에서 정상 동작하지 않음