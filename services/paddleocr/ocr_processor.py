"""
PaddleOCR Wrapper for OCR Processing
Handles image and PDF file processing with PaddleOCR 3.x API
Updated for PaddleOCR 2.9.x / PaddlePaddle 3.x compatibility
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


class OcrProcessor:
    """
    PaddleOCR wrapper class for processing images and PDFs.

    Features:
    - PaddleOCR 3.x API with predict() method
    - Support for JPEG, PNG images
    - Support for PDF files (page-by-page conversion)
    - Structured output with text, bounding boxes, and confidence scores
    """

    def __init__(self, lang: str = "en"):
        """
        Initialize PaddleOCR with configuration optimized for Docker/container environment.

        Args:
            lang: Language for OCR (default: "en")
        """
        logger.info(f"Initializing PaddleOCR with lang={lang}")

        # PaddleOCR 3.x initialization - disable problematic features
        # These settings prevent segfaults in containerized environments
        self.ocr = PaddleOCR(
            use_doc_orientation_classify=False,  # Disable document orientation
            use_doc_unwarping=False,             # Disable document unwarping
            use_textline_orientation=False,      # Disable textline orientation
            lang=lang,
            device="cpu",  # CPU-only for portability
            show_log=False,  # Reduce log noise
        )

        # Table recognition disabled - PPStructureV3 has compatibility issues
        self.enable_table = False

        logger.info("PaddleOCR initialized successfully")

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
        Process a single image and extract OCR results using PaddleOCR 3.x API.

        Args:
            content: Image bytes
            page: Page number for result tagging

        Returns:
            List of OCR result dictionaries
        """
        try:
            # Save to temp file - PaddleOCR 3.x predict() works better with file paths
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                # PaddleOCR 3.x API: use predict() method
                result = self.ocr.predict(input=tmp_path)
                return self._format_results(result, page)
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

    def _format_results(self, ocr_result: Any, page: int) -> List[dict]:
        """
        Format PaddleOCR 3.x results into structured output.

        PaddleOCR 3.x predict() returns a list of PaddleOCR result objects.
        Each result has rec_texts, rec_scores, and dt_polys attributes.

        Args:
            ocr_result: Raw PaddleOCR 3.x output from predict()
            page: Page number

        Returns:
            List of formatted result dictionaries
        """
        formatted = []

        if not ocr_result:
            return formatted

        # PaddleOCR 3.x returns list of result objects
        for result_obj in ocr_result:
            try:
                # Access attributes from result object
                # Different versions may have different attribute names
                rec_texts = getattr(result_obj, 'rec_texts', None)
                rec_scores = getattr(result_obj, 'rec_scores', None)
                dt_polys = getattr(result_obj, 'dt_polys', None)

                # Alternative attribute names
                if rec_texts is None:
                    rec_texts = getattr(result_obj, 'rec_text', [])
                if rec_scores is None:
                    rec_scores = getattr(result_obj, 'rec_score', [])
                if dt_polys is None:
                    dt_polys = getattr(result_obj, 'dt_poly', [])

                # If still None, try to access as dict
                if rec_texts is None and hasattr(result_obj, '__dict__'):
                    data = result_obj.__dict__
                    rec_texts = data.get('rec_texts', data.get('rec_text', []))
                    rec_scores = data.get('rec_scores', data.get('rec_score', []))
                    dt_polys = data.get('dt_polys', data.get('dt_poly', []))

                if not rec_texts:
                    # Try to get from 'res' attribute if present
                    if hasattr(result_obj, 'res') and result_obj.res:
                        for item in result_obj.res:
                            if isinstance(item, dict):
                                text = item.get('text', '')
                                score = item.get('score', 0.0)
                                bbox = item.get('bbox', [[0,0], [0,0], [0,0], [0,0]])
                                if text:
                                    formatted.append({
                                        "text": str(text),
                                        "confidence": round(float(score), 4),
                                        "bbox": [[int(c) for c in p] for p in bbox] if bbox else [[0,0]]*4,
                                        "page": page
                                    })
                    continue

                # Process parallel arrays
                for i, text in enumerate(rec_texts):
                    if not text:
                        continue

                    confidence = rec_scores[i] if i < len(rec_scores) else 0.0
                    bbox = dt_polys[i] if i < len(dt_polys) else [[0,0], [0,0], [0,0], [0,0]]

                    # Convert bbox to integer coordinates
                    try:
                        bbox_int = [[int(coord) for coord in point] for point in bbox]
                    except (TypeError, ValueError):
                        bbox_int = [[0, 0], [0, 0], [0, 0], [0, 0]]

                    formatted.append({
                        "text": str(text),
                        "confidence": round(float(confidence), 4),
                        "bbox": bbox_int,
                        "page": page
                    })

            except Exception as e:
                logger.warning(f"Error parsing result object: {e}, object type: {type(result_obj)}")
                # Try fallback parsing
                try:
                    self._fallback_parse(result_obj, page, formatted)
                except Exception as fallback_error:
                    logger.warning(f"Fallback parsing also failed: {fallback_error}")
                continue

        return formatted

    def _fallback_parse(self, result_obj: Any, page: int, formatted: List[dict]) -> None:
        """
        Fallback parsing for different PaddleOCR result formats.
        """
        # Try treating as old-style list format
        if isinstance(result_obj, list):
            for item in result_obj:
                if item is None:
                    continue
                if isinstance(item, list) and len(item) >= 2:
                    bbox = item[0]
                    text_info = item[1]
                    if isinstance(text_info, tuple) and len(text_info) >= 2:
                        text, confidence = text_info[0], text_info[1]
                        try:
                            bbox_int = [[int(coord) for coord in point] for point in bbox]
                        except:
                            bbox_int = [[0,0]]*4
                        formatted.append({
                            "text": str(text),
                            "confidence": round(float(confidence), 4),
                            "bbox": bbox_int,
                            "page": page
                        })

    def get_model_info(self) -> dict:
        """
        Get information about the loaded OCR model.

        Returns:
            Dictionary with model version and capabilities
        """
        features = ["text_detection", "text_recognition"]

        return {
            "version": "PaddleOCR-3.x",
            "languages": ["en", "ch", "id"],
            "features": features
        }
