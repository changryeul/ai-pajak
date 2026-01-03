"""
PaddleOCR FastAPI Service
Provides REST API endpoints for OCR processing
"""

import os
import time
import logging
import json
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ocr_processor import OcrProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize OCR processor (lazy loading)
_ocr_processor: Optional[OcrProcessor] = None


def get_ocr_processor() -> OcrProcessor:
    """Get or initialize the OCR processor singleton."""
    global _ocr_processor
    if _ocr_processor is None:
        logger.info("Initializing OCR processor...")
        _ocr_processor = OcrProcessor(lang="en", use_textline_orientation=True)
    return _ocr_processor


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown events."""
    # Startup
    logger.info("Starting PaddleOCR service...")
    try:
        get_ocr_processor()
        logger.info("OCR processor initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize OCR processor: {e}")
        # Don't raise - allow service to start, will init on first request

    yield

    # Shutdown
    logger.info("Shutting down PaddleOCR service...")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title="PaddleOCR Service",
    description="OCR processing service using PP-OCRv5",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration - configurable via environment variables
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for API responses
class OcrResult(BaseModel):
    text: str
    confidence: float
    bbox: List[List[int]]
    page: int = 1


class TableCell(BaseModel):
    row: int
    col: int
    text: str
    confidence: float


class TableResult(BaseModel):
    page: int
    cells: List[TableCell]
    bbox: Optional[List[List[int]]] = None
    html: Optional[str] = None


class OcrResponse(BaseModel):
    success: bool
    processing_time_ms: int
    results: List[OcrResult]
    tables: Optional[List[TableResult]] = None
    engine: str = "PADDLEOCR"
    model_version: str = "PP-OCRv5"


class HealthResponse(BaseModel):
    status: str
    engine: str


class InfoResponse(BaseModel):
    version: str
    languages: List[str]
    features: List[str]


class ErrorResponse(BaseModel):
    detail: str


# Error handling middleware
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )


@app.get("/health", response_model=HealthResponse)
async def health():
    """
    Health check endpoint.
    Returns service status for Docker health checks and load balancers.
    """
    return {"status": "healthy", "engine": "PADDLEOCR"}


@app.get("/info", response_model=InfoResponse)
async def info():
    """
    Get OCR model information.
    Returns version, supported languages, and available features.
    """
    processor = get_ocr_processor()
    return processor.get_model_info()


@app.post(
    "/ocr/process",
    response_model=OcrResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid file type"},
        413: {"model": ErrorResponse, "description": "File too large"},
        500: {"model": ErrorResponse, "description": "Processing error"}
    }
)
async def process_ocr(file: UploadFile = File(...)):
    """
    Process image or PDF file with OCR.

    Accepts JPEG, PNG images and PDF files up to 10MB.
    Returns extracted text with coordinates and confidence scores.
    """
    # File size validation (10MB limit)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is 10MB, got {file_size / 1024 / 1024:.2f}MB"
        )

    # Content type validation
    allowed_types = ["image/jpeg", "image/png", "application/pdf"]
    content_type = file.content_type or "application/octet-stream"

    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: {', '.join(allowed_types)}"
        )

    start_time = time.time()

    try:
        processor = get_ocr_processor()
        results, tables = processor.process(content, content_type)

        processing_time_ms = int((time.time() - start_time) * 1000)

        # Structured logging
        logger.info(json.dumps({
            "event": "ocr_complete",
            "file_name": file.filename,
            "file_size_bytes": file_size,
            "content_type": content_type,
            "processing_time_ms": processing_time_ms,
            "result_count": len(results)
        }))

        # Convert table results to TableResult objects
        table_results = None
        if tables:
            table_results = [
                TableResult(
                    page=t["page"],
                    cells=[TableCell(**c) for c in t.get("cells", [])],
                    bbox=t.get("bbox"),
                    html=t.get("html")
                )
                for t in tables
            ]

        return OcrResponse(
            success=True,
            processing_time_ms=processing_time_ms,
            results=[OcrResult(**r) for r in results],
            tables=table_results
        )

    except Exception as e:
        processing_time_ms = int((time.time() - start_time) * 1000)

        logger.error(json.dumps({
            "event": "ocr_error",
            "file_name": file.filename,
            "file_size_bytes": file_size,
            "processing_time_ms": processing_time_ms,
            "error": str(e)
        }))

        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}"
        )


