"""
Unit tests for PaddleOCR Service
Tests API endpoints and OCR processing functionality
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import io

# Import the FastAPI app
from main import app, get_ocr_processor


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def mock_ocr_processor():
    """Mock the OCR processor for unit tests."""
    mock_processor = MagicMock()
    mock_processor.process.return_value = (
        [
            {
                "text": "Sample Text",
                "confidence": 0.95,
                "bbox": [[10, 20], [100, 20], [100, 50], [10, 50]],
                "page": 1
            }
        ],
        None  # No tables
    )
    mock_processor.get_model_info.return_value = {
        "version": "PP-OCRv5",
        "languages": ["en", "id"],
        "features": ["text_detection", "text_recognition", "textline_orientation", "table_recognition"]
    }
    return mock_processor


@pytest.fixture
def mock_ocr_processor_with_tables():
    """Mock the OCR processor with table results."""
    mock_processor = MagicMock()
    mock_processor.process.return_value = (
        [
            {
                "text": "Invoice Header",
                "confidence": 0.95,
                "bbox": [[10, 20], [100, 20], [100, 50], [10, 50]],
                "page": 1
            }
        ],
        [
            {
                "page": 1,
                "cells": [
                    {"row": 0, "col": 0, "text": "Item", "confidence": 0.92},
                    {"row": 0, "col": 1, "text": "Price", "confidence": 0.94},
                    {"row": 1, "col": 0, "text": "Product A", "confidence": 0.91},
                    {"row": 1, "col": 1, "text": "$100", "confidence": 0.93},
                ],
                "bbox": [[50, 100], [300, 100], [300, 250], [50, 250]],
                "html": "<table><tr><td>Item</td><td>Price</td></tr></table>"
            }
        ]
    )
    mock_processor.get_model_info.return_value = {
        "version": "PP-OCRv5",
        "languages": ["en", "id"],
        "features": ["text_detection", "text_recognition", "textline_orientation", "table_recognition"]
    }
    return mock_processor


class TestHealthEndpoint:
    """Tests for /health endpoint."""

    def test_health_returns_healthy(self, client):
        """Test that health endpoint returns healthy status."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["engine"] == "PADDLEOCR"


class TestInfoEndpoint:
    """Tests for /info endpoint."""

    def test_info_returns_model_info(self, client, mock_ocr_processor):
        """Test that info endpoint returns model information."""
        with patch("main.get_ocr_processor", return_value=mock_ocr_processor):
            response = client.get("/info")

        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "PP-OCRv5"
        assert "en" in data["languages"]
        assert "text_detection" in data["features"]


class TestOcrProcessEndpoint:
    """Tests for /ocr/process endpoint."""

    def test_process_jpeg_image(self, client, mock_ocr_processor):
        """Test OCR processing of JPEG image."""
        # Create a minimal valid JPEG (1x1 pixel)
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
            0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
            0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        ] + [0x08] * 64 + [0xFF, 0xD9])

        with patch("main.get_ocr_processor", return_value=mock_ocr_processor):
            response = client.post(
                "/ocr/process",
                files={"file": ("test.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["engine"] == "PADDLEOCR"
        assert data["model_version"] == "PP-OCRv5"
        assert len(data["results"]) == 1
        assert data["results"][0]["text"] == "Sample Text"

    def test_process_png_image(self, client, mock_ocr_processor):
        """Test OCR processing of PNG image."""
        # Create a minimal valid PNG (1x1 pixel, white)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])

        with patch("main.get_ocr_processor", return_value=mock_ocr_processor):
            response = client.post(
                "/ocr/process",
                files={"file": ("test.png", io.BytesIO(png_data), "image/png")}
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_reject_unsupported_file_type(self, client):
        """Test that unsupported file types are rejected."""
        response = client.post(
            "/ocr/process",
            files={"file": ("test.txt", io.BytesIO(b"Hello World"), "text/plain")}
        )

        assert response.status_code == 400
        assert "Unsupported file type" in response.json()["detail"]

    def test_reject_large_file(self, client):
        """Test that files over 10MB are rejected."""
        # Create a file larger than 10MB
        large_data = b"x" * (11 * 1024 * 1024)  # 11MB

        response = client.post(
            "/ocr/process",
            files={"file": ("large.jpg", io.BytesIO(large_data), "image/jpeg")}
        )

        assert response.status_code == 413
        assert "File too large" in response.json()["detail"]


class TestTableRecognition:
    """Tests for table recognition functionality."""

    def test_process_image_with_tables(self, client, mock_ocr_processor_with_tables):
        """Test OCR processing returns table results."""
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
            0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
            0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        ] + [0x08] * 64 + [0xFF, 0xD9])

        with patch("main.get_ocr_processor", return_value=mock_ocr_processor_with_tables):
            response = client.post(
                "/ocr/process",
                files={"file": ("invoice.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["tables"] is not None
        assert len(data["tables"]) == 1

        table = data["tables"][0]
        assert table["page"] == 1
        assert len(table["cells"]) == 4
        assert table["cells"][0]["text"] == "Item"
        assert table["html"] is not None

    def test_table_recognition_in_features(self, client, mock_ocr_processor):
        """Test that table_recognition is listed in features."""
        with patch("main.get_ocr_processor", return_value=mock_ocr_processor):
            response = client.get("/info")

        assert response.status_code == 200
        data = response.json()
        assert "table_recognition" in data["features"]


class TestLanguageSupport:
    """Tests for multi-language support."""

    def test_indonesian_language_in_model_info(self, client, mock_ocr_processor):
        """Test that Indonesian (id) language is supported."""
        with patch("main.get_ocr_processor", return_value=mock_ocr_processor):
            response = client.get("/info")

        assert response.status_code == 200
        data = response.json()
        assert "id" in data["languages"], "Indonesian language should be supported"


class TestOcrProcessor:
    """Tests for the OcrProcessor class."""

    def test_format_results_empty(self):
        """Test formatting of empty OCR results."""
        from ocr_processor import OcrProcessor

        # Create a mock instance without initializing PaddleOCR
        with patch.object(OcrProcessor, "__init__", lambda x, **kwargs: None):
            processor = OcrProcessor()
            processor.ocr = MagicMock()

            result = processor._format_results(None, page=1)
            assert result == []

            result = processor._format_results([[]], page=1)
            assert result == []

    def test_format_results_with_data(self):
        """Test formatting of valid OCR results."""
        from ocr_processor import OcrProcessor

        # Create a mock instance
        with patch.object(OcrProcessor, "__init__", lambda x, **kwargs: None):
            processor = OcrProcessor()
            processor.ocr = MagicMock()

            ocr_result = [[
                [[[10.5, 20.3], [100.7, 20.1], [100.9, 50.4], [10.2, 50.6]], ("Test Text", 0.9567)]
            ]]

            result = processor._format_results(ocr_result, page=2)

            assert len(result) == 1
            assert result[0]["text"] == "Test Text"
            assert result[0]["confidence"] == 0.9567
            assert result[0]["page"] == 2
            # Check bbox is converted to integers
            assert all(isinstance(coord, int) for point in result[0]["bbox"] for coord in point)

    def test_get_model_info(self):
        """Test model info retrieval."""
        from ocr_processor import OcrProcessor

        with patch.object(OcrProcessor, "__init__", lambda x, **kwargs: None):
            processor = OcrProcessor()
            processor.ocr = MagicMock()

            info = processor.get_model_info()

            assert info["version"] == "PP-OCRv5"
            assert "en" in info["languages"]


class TestResponseModels:
    """Tests for Pydantic response models."""

    def test_ocr_response_model(self):
        """Test OcrResponse model validation."""
        from main import OcrResponse, OcrResult

        response = OcrResponse(
            success=True,
            processing_time_ms=100,
            results=[
                OcrResult(
                    text="Test",
                    confidence=0.95,
                    bbox=[[0, 0], [10, 0], [10, 10], [0, 10]],
                    page=1
                )
            ]
        )

        assert response.success is True
        assert response.engine == "PADDLEOCR"
        assert response.model_version == "PP-OCRv5"
        assert len(response.results) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
