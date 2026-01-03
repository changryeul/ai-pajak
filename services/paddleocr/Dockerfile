# PaddleOCR Service Dockerfile
# PP-OCRv5 with FastAPI on Python 3.12

FROM python:3.12-slim-bookworm

# Prevent Python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # OpenCV dependencies
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
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
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Pre-download PP-OCRv5 models to avoid first-request delay
# This downloads detection, recognition, and angle classification models
# Note: PaddleOCR 3.x uses use_textline_orientation instead of use_angle_cls
ENV DISABLE_MODEL_SOURCE_CHECK=True
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_textline_orientation=True, lang='en')"

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
# Using 2 workers for better concurrency while keeping memory reasonable
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
