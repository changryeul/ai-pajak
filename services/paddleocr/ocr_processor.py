"""
PaddleOCR Wrapper for OCR Processing
Handles image and PDF file processing with PaddleOCR 3.3.x API
Compatible with PaddleOCR 3.3.x / PaddlePaddle 3.2.x on Apple Silicon
"""

import io
import logging
import tempfile
import os
from typing import List, Tuple, Optional, Any

import numpy as np
from PIL import Image
from paddleocr import PaddleOCR

logger = logging.getLogger(__name__)

# Disable model source connectivity check for faster startup
os.environ['DISABLE_MODEL_SOURCE_CHECK'] = 'True'


class OcrProcessor:
    """
    PaddleOCR wrapper class for processing images and PDFs.

    Features:
    - PaddleOCR 3.3.x API with predict() method
    - Support for JPEG, PNG images
    - Support for PDF files (page-by-page conversion)
    - Structured output with text, bounding boxes, and confidence scores
    - Optimized for Apple Silicon (M1/M2/M3) with Accelerate BLAS
    """

    def __init__(self, lang: str = "en"):
        """
        Initialize PaddleOCR with configuration.

        Args:
            lang: Language for OCR (default: "en")
        """
        logger.info(f"Initializing PaddleOCR 3.3.x with lang={lang}")

        # PaddleOCR 3.3.x initialization
        # Note: API has changed from 2.9.x
        self.ocr = PaddleOCR(
            lang=lang,
            use_doc_orientation_classify=False,  # Disable for speed
            use_doc_unwarping=False,             # Disable for speed
            use_textline_orientation=False,      # Disable for speed
        )

        # Table recognition disabled - PPStructureV3 has compatibility issues
        self.enable_table = False

        logger.info("PaddleOCR 3.3.x initialized successfully")

    def process(
        self,
        content: bytes,
        content_type: str
    ) -> Tuple[List[dict], Optional[List[dict]]]:
        """
        Process file content and extract OCR results.

        Args:
            content: Raw file bytes
            content_type: MIME type of the file

        Returns:
            Tuple of (results, tables) where:
            - results: List of OCR result dicts with text, confidence, bbox, page
            - tables: None (table recognition currently disabled)
        """
        if content_type == "application/pdf":
            return self._process_pdf(content)
        else:
            ocr_results = self._process_image(content)
            return ocr_results, None

    def _process_image(self, content: bytes, page: int = 1) -> List[dict]:
        """
        Process a single image and extract OCR results using PaddleOCR 3.3.x API.

        Args:
            content: Image bytes
            page: Page number for result tagging

        Returns:
            List of OCR result dictionaries
        """
        try:
            # Save to temp file - PaddleOCR works better with file paths
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                # PaddleOCR 3.3.x API: use predict() method
                result = self.ocr.predict(tmp_path)
                return self._format_results_v3(result, page)
            finally:
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        except Exception as e:
            logger.error(f"Image processing error: {str(e)}")
            raise

    def _process_pdf(self, content: bytes) -> Tuple[List[dict], Optional[List[dict]]]:
        """
        Process PDF file page by page.

        Args:
            content: PDF file bytes

        Returns:
            Tuple of (all_results, None)
        """
        try:
            from pdf2image import convert_from_bytes

            # Convert PDF to images
            images = convert_from_bytes(content, dpi=200)

            all_results = []

            for page_num, image in enumerate(images, start=1):
                # Convert PIL Image to bytes
                img_byte_arr = io.BytesIO()
                image.save(img_byte_arr, format="PNG")
                img_bytes = img_byte_arr.getvalue()

                # Process each page for OCR
                page_results = self._process_image(img_bytes, page=page_num)
                all_results.extend(page_results)

            return all_results, None

        except Exception as e:
            logger.error(f"PDF processing error: {str(e)}")
            raise

    def _format_results_v3(self, ocr_result: Any, page: int) -> List[dict]:
        """
        Format PaddleOCR 3.3.x results into structured output.

        PaddleOCR 3.3.x predict() method returns:
        [
            {
                'rec_texts': ['text1', 'text2', ...],
                'rec_scores': [0.99, 0.98, ...],
                'rec_polys': [array([[x1,y1], [x2,y2], [x3,y3], [x4,y4]]), ...],
                ...
            }
        ]

        Args:
            ocr_result: Raw PaddleOCR 3.3.x output from predict()
            page: Page number

        Returns:
            List of formatted result dictionaries
        """
        formatted = []

        if not ocr_result:
            return formatted

        # PaddleOCR 3.3.x returns a list with one dict per image
        for result_dict in ocr_result:
            if result_dict is None:
                continue

            texts = result_dict.get('rec_texts', [])
            scores = result_dict.get('rec_scores', [])
            polys = result_dict.get('rec_polys', [])

            # Iterate through all recognized text items
            for i, text in enumerate(texts):
                if not text:
                    continue

                try:
                    confidence = scores[i] if i < len(scores) else 0.0
                    poly = polys[i] if i < len(polys) else None

                    # Convert bbox to integer coordinates
                    if poly is not None:
                        try:
                            # poly is numpy array of shape (4, 2)
                            bbox_int = [[int(coord) for coord in point] for point in poly]
                        except (TypeError, ValueError):
                            bbox_int = [[0, 0], [0, 0], [0, 0], [0, 0]]
                    else:
                        bbox_int = [[0, 0], [0, 0], [0, 0], [0, 0]]

                    formatted.append({
                        "text": str(text),
                        "confidence": round(float(confidence), 4),
                        "bbox": bbox_int,
                        "page": page
                    })

                except (IndexError, TypeError) as e:
                    logger.warning(f"Error parsing result at index {i}: {e}")
                    continue

        return formatted

    def get_model_info(self) -> dict:
        """
        Get information about the loaded OCR model.

        Returns:
            Dictionary with model version and capabilities
        """
        features = ["text_detection", "text_recognition"]

        return {
            "version": "PP-OCRv5",
            "languages": ["en", "ch", "id"],
            "features": features
        }
