# PaddleOCR Service Dockerfile
# PP-OCRv5 with FastAPI on Python 3.12
# Compatible with ARM64 (Apple Silicon) and x86_64

FROM python:3.12-slim-bookworm

# Prevent Python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# PaddlePaddle performance settings
# Note: PaddlePaddle 3.2.x includes Apple Accelerate BLAS fix (PR #64408)
# These settings are kept for compatibility but may not be needed
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV DISABLE_MODEL_SOURCE_CHECK=True

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # OpenCV dependencies
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    # PaddlePaddle dependencies (OpenMP for multithreading)
    libgomp1 \
    # PDF processing (poppler for pdf2image)
    poppler-utils \
    # Health check
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
# PaddlePaddle 3.2.x and PaddleOCR 3.3.x with ARM64 support
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Pre-download PP-OCRv5 models to avoid first-request delay
# Using PaddleOCR 3.3.x API
RUN python -c "\
import os; \
os.environ['DISABLE_MODEL_SOURCE_CHECK'] = 'True'; \
from paddleocr import PaddleOCR; \
PaddleOCR(lang='en', use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False) \
" || echo "Model pre-download skipped, will download on first request"

# Copy application code
COPY main.py ocr_processor.py ./

# Create models directory for any additional models
COPY models/ ./models/

# Create non-root user for security
RUN useradd -m -u 1000 appuser \
    && chown -R appuser:appuser /app \
    && chown -R appuser:appuser /home/appuser

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run with uvicorn
# Using single worker - PaddlePaddle is not fork-safe
# For production scaling, use container orchestration (k8s replicas) instead
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
