#!/bin/bash
# PaddleOCR Service - curl Test Script
# Usage: ./test.sh [image_file]

BASE_URL="${PADDLEOCR_URL:-http://localhost:8080}"

echo "=========================================="
echo "PaddleOCR Service Test Script"
echo "Target: $BASE_URL"
echo "=========================================="

# Test 1: Health Check
echo -e "\n[1] Testing /health endpoint..."
curl -s "$BASE_URL/health" | jq .
if [ $? -eq 0 ]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    exit 1
fi

# Test 2: Info Endpoint
echo -e "\n[2] Testing /info endpoint..."
curl -s "$BASE_URL/info" | jq .
if [ $? -eq 0 ]; then
    echo "✅ Info endpoint passed"
else
    echo "❌ Info endpoint failed"
fi

# Test 3: OCR Process (if image file provided)
if [ -n "$1" ]; then
    echo -e "\n[3] Testing /ocr/process with file: $1"

    if [ ! -f "$1" ]; then
        echo "❌ File not found: $1"
        exit 1
    fi

    # Determine content type
    CONTENT_TYPE="image/jpeg"
    if [[ "$1" == *.png ]]; then
        CONTENT_TYPE="image/png"
    elif [[ "$1" == *.pdf ]]; then
        CONTENT_TYPE="application/pdf"
    fi

    echo "Content-Type: $CONTENT_TYPE"

    START_TIME=$(date +%s%N)
    RESPONSE=$(curl -s -X POST "$BASE_URL/ocr/process" \
        -F "file=@$1;type=$CONTENT_TYPE")
    END_TIME=$(date +%s%N)

    ELAPSED=$(( (END_TIME - START_TIME) / 1000000 ))

    echo "$RESPONSE" | jq .
    echo -e "\n⏱️  Total request time: ${ELAPSED}ms"

    # Check success
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    if [ "$SUCCESS" == "true" ]; then
        echo "✅ OCR processing passed"
        RESULT_COUNT=$(echo "$RESPONSE" | jq '.results | length')
        echo "📝 Extracted $RESULT_COUNT text blocks"
    else
        echo "❌ OCR processing failed"
    fi
else
    echo -e "\n[3] Skipping OCR test (no image file provided)"
    echo "    Usage: ./test.sh path/to/image.jpg"
fi

echo -e "\n=========================================="
echo "Test complete!"
echo "=========================================="
