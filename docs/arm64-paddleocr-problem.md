# PaddleOCR ARM64 (Apple Silicon) 호환성 문제 리서치

> 작성일: 2026-01-11
> 리서치 도구: Tavily Search, Sequential Thinking

## 개요

PaddleOCR와 PaddlePaddle은 Apple Silicon (M1, M2, M3) 및 ARM64 아키텍처에서 심각한 호환성 문제를 가지고 있습니다. 이 문제는 2024년부터 지속적으로 보고되고 있으며, 2025년 현재까지 완전히 해결되지 않았습니다.

## 증상

### 1. Segmentation Fault (SIGSEGV)
```
FatalError: `Segmentation fault` is detected by the operating system.
[SignalInfo: SIGSEGV (@0x0) received by PID 1 (TID 0xffff612341a0) from PID 0]
```

### 2. 메모리 할당자 오류
```
RuntimeError: (NotFound) No allocator found for the place, Place(undefined:0)
[Hint: Expected iter != allocators.end(), but received iter == allocators.end().]
(at ../paddle/phi/core/memory/allocation/allocator_facade.cc:381)
[operator < matmul > error]
```

### 3. 프로세스 멈춤
- 터미널에서 PaddleOCR 실행 시 응답 없음
- Ctrl+C로 종료 불가, Ctrl+Z만 가능
- OCR 초기화는 성공하나 실제 추론(inference) 시 크래시

## 영향받는 환경

| 환경 | 버전 | 증상 |
|------|------|------|
| macOS Apple Silicon (M1/M2/M3) | PaddlePaddle 3.0.0 + PaddleOCR 2.9.x~3.3.0 | Segfault |
| macOS Apple Silicon | PaddlePaddle 2.6.x + PaddleOCR 2.8.x | Segfault |
| Docker ARM64 | PaddlePaddle 3.0.0 + PaddleOCR 3.3.0 | Segfault |
| AWS Lambda ARM64 | PaddlePaddle 3.0.0 | libpaddle 로딩 실패 |

## 근본 원인

### 1. OpenBLAS 라이브러리 호환성 문제
PaddlePaddle은 OpenBLAS 0.3.13 버전(2022년 12월 릴리스)에 고정되어 있습니다. 이 버전은 Apple M1이 시장에 출시되기 전에 릴리스되어 ARM64 최적화가 부재합니다.

> "I suspect this is related to blas library paddlepaddle is using on mac. It's using openblas, and pinned to version 0.3.13, which is a release of openblas at 2022-12, there is no mac m1 on the market at that time."
> — GitHub Discussion #13061 (jzhang533, PaddlePaddle 메인테이너)

### 2. Apple Accelerate 프레임워크 미사용
Apple은 자체 BLAS 구현체인 Accelerate 프레임워크를 제공하며, 이는 M 시리즈 칩에 최적화되어 있습니다. 그러나 PaddlePaddle은 범용 OpenBLAS를 사용하여 성능과 호환성 문제가 발생합니다.

### 3. ARM64 메모리 할당자 문제
`Place(undefined:0)` 에러는 PaddlePaddle의 메모리 할당 시스템이 ARM64 디바이스를 올바르게 인식하지 못함을 나타냅니다.

## 시도된 해결책과 결과

### 효과 없음

| 해결책 | 결과 |
|--------|------|
| 환경변수 설정 (`FLAGS_use_mkldnn=0`, `OMP_NUM_THREADS=1` 등) | 효과 없음 |
| NumPy 버전 고정 (`numpy<2.0.0`) | 효과 없음 |
| PaddlePaddle 3.0.0b2 (베타) | 동일한 Segfault |
| PaddlePaddle 2.6.1 다운그레이드 | API 호환성 문제 (`set_optimization_level` 누락) |
| 경량 모델 사용 (PP-OCRv4_mobile) | API 파라미터 변경으로 실패 |

### 부분적 효과

| 해결책 | 결과 |
|--------|------|
| Nightly 빌드 사용 | 일부 사용자 성공 보고 |
| PaddlePaddle 2.3.2 + PaddleOCR 2.6.1.0 + Python 3.9.6 | M1에서 동작 (2022년 보고) |

### Nightly 빌드 설치 방법
```bash
python -m pip install paddlepaddle==0.0.0 -f https://www.paddlepaddle.org.cn/whl/mac/cpu/develop.html
```

## 권장 대안

### 1. Tesseract OCR 사용 (로컬 개발용)
```bash
# macOS 설치
brew install tesseract tesseract-lang

# Python 바인딩
pip install pytesseract
```

**장점:**
- Apple Silicon에서 안정적으로 동작
- 다국어 지원 (한국어, 인도네시아어 등)
- 설치 간편

**단점:**
- PaddleOCR 대비 정확도 낮음 (특히 복잡한 레이아웃)

### 2. x86_64 서버에서 PaddleOCR 실행 (프로덕션용)
```yaml
# docker-compose.yml (x86_64 서버)
services:
  paddleocr:
    image: paddlepaddle/paddle:latest
    platform: linux/amd64
    ports:
      - "8080:8080"
```

### 3. 클라우드 OCR 서비스
- Google Cloud Vision API
- AWS Textract
- Azure Computer Vision

## 관련 GitHub 이슈

| 이슈 | 제목 | 상태 |
|------|------|------|
| [Paddle#76111](https://github.com/PaddlePaddle/Paddle/issues/76111) | PaddleOCR v3.3.0 + PaddlePaddle v3.0.0 fails in Docker (ARM64 & x86_64) | Open |
| [PaddleOCR#16685](https://github.com/PaddlePaddle/PaddleOCR/issues/16685) | ARM64 cpu Segmentation fault | Closed |
| [PaddleOCR#16457](https://github.com/PaddlePaddle/PaddleOCR/issues/16457) | Segmentation fault on Mac OS | Closed |
| [Paddle#72413](https://github.com/PaddlePaddle/Paddle/issues/72413) | No allocator found for the place, Place(undefined:0) | Open |
| [PaddleOCR#13061](https://github.com/PaddlePaddle/PaddleOCR/discussions/13061) | PaddleOcr do not work on mac anymore | Answered |
| [PaddleOCR#11706](https://github.com/PaddlePaddle/PaddleOCR/issues/11706) | PaddleOcr do not work on mac anymore | Closed |

## 진행 중인 수정

PaddlePaddle 팀에서 Apple의 BLAS 라이브러리를 사용하도록 변경하는 PR이 진행 중입니다:
- [Paddle#64408](https://github.com/PaddlePaddle/Paddle/pull/64408): Apple Accelerate 프레임워크 지원

## 해결책: PaddlePaddle 3.2.x + PaddleOCR 3.3.x

**2026년 1월 업데이트**: PaddlePaddle 3.2.x부터 Apple Silicon이 공식 지원됩니다!

### 설치 방법
```bash
pip install paddlepaddle>=3.2.0
pip install paddleocr>=3.3.0
```

### 테스트 결과 (Apple Silicon M 시리즈)
- **이미지 OCR**: 57개 텍스트 라인 감지, 18.6초 처리
- **PDF OCR**: 정상 동작
- **Docker ARM64**: PaddlePaddle 3.2.x로 지원 예상

### API 변경사항 (PaddleOCR 3.3.x)
```python
# OLD (2.9.x)
result = ocr.ocr(image_path, cls=True)

# NEW (3.3.x)
result = ocr.predict(image_path)
# 결과 형식: [{'rec_texts': [...], 'rec_scores': [...], 'rec_polys': [...]}]
```

### 권장 설정
```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(
    lang='en',
    use_doc_orientation_classify=False,  # 속도 최적화
    use_doc_unwarping=False,
    use_textline_orientation=False,
)
```

## 결론

**PaddlePaddle 3.2.x + PaddleOCR 3.3.x 조합으로 Apple Silicon에서 정상 동작합니다.**

- Apple Accelerate BLAS 라이브러리 사용 (PR #64408)
- PyPI에서 공식 ARM64 휠 제공
- Docker ARM64 환경에서도 동작 예상

---

*이 문서는 AI Pajak 프로젝트의 OCR 서비스 개발 중 발견된 문제와 해결책을 기록한 것입니다.*
*마지막 업데이트: 2026-01-11*
