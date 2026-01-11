# PaddleOCR 배포 전략

## 개발 환경 (로컬)
- **PaddleOCR은 로컬에서 직접 실행** (Docker 사용 안 함)
- PaddlePaddle 3.2.x + PaddleOCR 3.3.x 사용
- Apple Silicon (M1/M2/M3)에서 정상 작동 (Apple Accelerate BLAS 지원)
- 포트: 8080

## 프로덕션 환경 (AWS)
- **AMD64 (x86_64) 아키텍처로 Docker 빌드**
- Linux ARM64에서는 여전히 Segfault 발생 (OpenBLAS 호환성 문제)
- AWS 배포 시 `--platform linux/amd64` 옵션 사용

## Docker 빌드 명령어 (AWS용)
```bash
docker build --platform linux/amd64 -t paddleocr:latest .
```

## 주의사항
- Apple Accelerate BLAS 수정 (PR #64408)은 **macOS 전용**
- Linux ARM64 환경에서는 아직 해결되지 않음
- AWS Lambda ARM64도 동일한 문제 있음

## 테스트 결과 (2026-01-11)
| 환경 | 결과 |
|------|------|
| macOS Apple Silicon (로컬) | ✅ 정상 작동 |
| Docker ARM64 (Linux) | ❌ Segfault |
| Docker AMD64 (Linux) | ✅ 정상 작동 예상 |
