#!/bin/bash
# PaddleOCR Docker Build Script
# Usage: ./build_docker.sh [--no-cache] [--push]

set -e

# Configuration
IMAGE_NAME="ai-pajak-paddleocr"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
NO_CACHE=""
PUSH=false

for arg in "$@"; do
    case $arg in
        --no-cache)
            NO_CACHE="--no-cache"
            ;;
        --push)
            PUSH=true
            ;;
        --help|-h)
            echo "Usage: ./build_docker.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-cache    Build without using cache"
            echo "  --push        Push image to registry after build"
            echo "  --help, -h    Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  IMAGE_TAG     Tag for the image (default: latest)"
            echo "  REGISTRY      Docker registry prefix (default: none)"
            echo ""
            echo "Examples:"
            echo "  ./build_docker.sh"
            echo "  ./build_docker.sh --no-cache"
            echo "  IMAGE_TAG=v1.0.0 ./build_docker.sh --push"
            echo "  REGISTRY=ghcr.io/myorg IMAGE_TAG=v1.0.0 ./build_docker.sh --push"
            exit 0
            ;;
    esac
done

# Determine full image name
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
else
    FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
fi

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}PaddleOCR Docker Build${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "Image: ${GREEN}${FULL_IMAGE_NAME}${NC}"
echo -e "No Cache: ${NO_CACHE:-false}"
echo -e "Push: ${PUSH}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Build image
echo -e "${YELLOW}[1/3] Building Docker image...${NC}"
docker build ${NO_CACHE} -t "${FULL_IMAGE_NAME}" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
else
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

# Show image info
echo ""
echo -e "${YELLOW}[2/3] Image info:${NC}"
docker images "${FULL_IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Push if requested
if [ "$PUSH" = true ]; then
    echo ""
    echo -e "${YELLOW}[3/3] Pushing to registry...${NC}"
    docker push "${FULL_IMAGE_NAME}"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Push successful!${NC}"
    else
        echo -e "${RED}❌ Push failed!${NC}"
        exit 1
    fi
else
    echo ""
    echo -e "${YELLOW}[3/3] Skipping push (use --push to push)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Done!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "To run the container:"
echo "  docker run -d -p 8080:8080 --name paddleocr ${FULL_IMAGE_NAME}"
echo ""
echo "To test:"
echo "  curl http://localhost:8080/health"
