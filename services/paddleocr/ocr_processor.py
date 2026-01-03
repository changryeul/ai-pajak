"""
PaddleOCR Wrapper for OCR Processing
Handles image and PDF file processing with PP-OCRv5 and PPStructure for table recognition
"""

import io
import logging
from typing import List, Tuple, Optional, Any

import numpy as np
from PIL import Image
from paddleocr import PaddleOCR, PPStructure

logger = logging.getLogger(__name__)


class OcrProcessor:
    """
    PaddleOCR wrapper class for processing images and PDFs.

    Features:
    - PP-OCRv5 model for text detection and recognition
    - PPStructure for table detection and recognition
    - Support for JPEG, PNG images
    - Support for PDF files (page-by-page conversion)
    - Structured output with text, bounding boxes, and confidence scores
    """

    def __init__(self, lang: str = "en", use_textline_orientation: bool = True, enable_table: bool = True):
        """
        Initialize PaddleOCR with specified configuration.

        Args:
            lang: Language for OCR (default: "en")
            use_textline_orientation: Enable textline orientation detection for rotated text
            enable_table: Enable table recognition with PPStructure (default: True)
        """
        logger.info(f"Initializing PaddleOCR with lang={lang}, use_textline_orientation={use_textline_orientation}")

        self.ocr = PaddleOCR(
            use_textline_orientation=use_textline_orientation,
            lang=lang,
            device="cpu",  # CPU-only for portability
        )

        self.enable_table = enable_table
        self.table_engine = None

        if enable_table:
            logger.info("Initializing PPStructure for table recognition...")
            try:
                self.table_engine = PPStructure(
                    layout=False,  # Table recognition only, no full layout analysis
                    table=True,
                    show_log=False,
                )
                logger.info("PPStructure initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize PPStructure: {e}. Table recognition disabled.")
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
            - tables: List of table extraction results (if applicable)
        """
        if content_type == "application/pdf":
            return self._process_pdf(content)
        else:
            ocr_results = self._process_image(content)
            table_results = self._extract_tables(content) if self.enable_table else None
            return ocr_results, table_results

    def _process_image(self, content: bytes, page: int = 1) -> List[dict]:
        """
        Process a single image and extract OCR results.

        Args:
            content: Image bytes
            page: Page number for result tagging

        Returns:
            List of OCR result dictionaries
        """
        try:
            # Convert bytes to numpy array
            image = Image.open(io.BytesIO(content))
            image_np = np.array(image.convert("RGB"))

            # Run OCR
            result = self.ocr.ocr(image_np)

            return self._format_results(result, page)

        except Exception as e:
            logger.error(f"Image processing error: {str(e)}")
            raise

    def _process_pdf(self, content: bytes) -> Tuple[List[dict], Optional[List[dict]]]:
        """
        Process PDF file page by page.

        Args:
            content: PDF file bytes

        Returns:
            Tuple of (all_results, tables)
        """
        try:
            from pdf2image import convert_from_bytes

            # Convert PDF to images
            images = convert_from_bytes(content, dpi=200)

            all_results = []
            all_tables = []

            for page_num, image in enumerate(images, start=1):
                # Convert PIL Image to bytes
                img_byte_arr = io.BytesIO()
                image.save(img_byte_arr, format="PNG")
                img_bytes = img_byte_arr.getvalue()

                # Process each page for OCR
                page_results = self._process_image(img_bytes, page=page_num)
                all_results.extend(page_results)

                # Process each page for tables
                if self.enable_table:
                    page_tables = self._extract_tables(img_bytes, page=page_num)
                    if page_tables:
                        all_tables.extend(page_tables)

            return all_results, all_tables if all_tables else None

        except Exception as e:
            logger.error(f"PDF processing error: {str(e)}")
            raise

    def _extract_tables(self, content: bytes, page: int = 1) -> Optional[List[dict]]:
        """
        Extract tables from image using PPStructure.

        Args:
            content: Image bytes
            page: Page number for result tagging

        Returns:
            List of table results or None if no tables found
        """
        if not self.enable_table or self.table_engine is None:
            return None

        try:
            # Convert bytes to numpy array
            image = Image.open(io.BytesIO(content))
            image_np = np.array(image.convert("RGB"))

            # Run table detection
            result = self.table_engine(image_np)

            tables = []
            for item in result:
                if item.get("type") == "table":
                    table_data = self._format_table_result(item, page)
                    if table_data:
                        tables.append(table_data)

            return tables if tables else None

        except Exception as e:
            logger.warning(f"Table extraction error: {str(e)}")
            return None

    def _format_table_result(self, table_item: dict, page: int) -> Optional[dict]:
        """
        Format PPStructure table result into structured output.

        Args:
            table_item: Raw PPStructure table detection result
            page: Page number

        Returns:
            Formatted table result dictionary
        """
        try:
            cells = []
            res = table_item.get("res", {})

            # Extract cell information from the table result
            if isinstance(res, dict):
                # Try to get HTML representation
                html = res.get("html", "")

                # Try to get cell boxes if available
                cell_boxes = res.get("cell_bbox", [])
                rec_res = res.get("rec_res", [])

                # If we have recognition results, format them as cells
                if rec_res:
                    for idx, (text, confidence) in enumerate(rec_res):
                        cell = {
                            "row": idx // 10,  # Approximate row
                            "col": idx % 10,   # Approximate col
                            "text": text,
                            "confidence": round(float(confidence), 4)
                        }
                        cells.append(cell)

            # Get bounding box of the entire table
            bbox = table_item.get("bbox", [])

            return {
                "page": page,
                "bbox": [[int(coord) for coord in point] for point in bbox] if bbox else None,
                "cells": cells,
                "html": res.get("html", "") if isinstance(res, dict) else ""
            }

        except Exception as e:
            logger.warning(f"Table formatting error: {str(e)}")
            return None

    def _format_results(self, ocr_result: Any, page: int) -> List[dict]:
        """
        Format PaddleOCR raw results into structured output.

        Args:
            ocr_result: Raw PaddleOCR output
            page: Page number

        Returns:
            List of formatted result dictionaries
        """
        formatted = []

        if not ocr_result or not ocr_result[0]:
            return formatted

        for line in ocr_result[0]:
            if line is None:
                continue

            bbox = line[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            text_info = line[1]  # (text, confidence)

            if text_info and len(text_info) >= 2:
                text, confidence = text_info[0], text_info[1]

                # Convert bbox to integer coordinates
                bbox_int = [[int(coord) for coord in point] for point in bbox]

                formatted.append({
                    "text": text,
                    "confidence": round(float(confidence), 4),
                    "bbox": bbox_int,
                    "page": page
                })

        return formatted

    def get_model_info(self) -> dict:
        """
        Get information about the loaded OCR model.

        Returns:
            Dictionary with model version and capabilities
        """
        features = ["text_detection", "text_recognition", "textline_orientation"]
        if self.enable_table:
            features.append("table_recognition")

        return {
            "version": "PP-OCRv5",
            "languages": ["en", "id"],
            "features": features
        }
