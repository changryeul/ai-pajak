#!/bin/bash
# ============================================
# AI Pajak API - Docker Build Script
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="ai-pajak-api"
CONTAINER_NAME="ai-pajak-api"
PORT="${PORT:-3333}"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo -e "${GREEN}🐳 AI Pajak API Docker Build Script${NC}"
echo "================================================"
echo "Project Root: $PROJECT_ROOT"
echo "Image Name: $IMAGE_NAME"
echo "Port: $PORT"
echo ""

# Functions
build() {
    echo -e "${YELLOW}📦 Building Docker image...${NC}"
    docker build -t "$IMAGE_NAME" -f "$PROJECT_ROOT/apps/api/Dockerfile" "$PROJECT_ROOT"
    echo -e "${GREEN}✅ Build complete!${NC}"
}

run() {
    echo -e "${YELLOW}🚀 Starting container...${NC}"

    # Stop existing container if running
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$PORT:$PORT" \
        -e PORT="$PORT" \
        -e DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@host.docker.internal:5432/ai_pajak?schema=public}" \
        "$IMAGE_NAME"

    echo -e "${GREEN}✅ Container started!${NC}"
    echo ""
    echo "API: http://localhost:$PORT"
    echo "Swagger: http://localhost:$PORT/swagger"
    echo "Health: http://localhost:$PORT/health"
}

stop() {
    echo -e "${YELLOW}🛑 Stopping container...${NC}"
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    echo -e "${GREEN}✅ Container stopped!${NC}"
}

logs() {
    docker logs -f "$CONTAINER_NAME"
}

status() {
    echo -e "${YELLOW}📊 Container Status${NC}"
    docker ps -a --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

shell() {
    echo -e "${YELLOW}🔧 Opening shell...${NC}"
    docker exec -it "$CONTAINER_NAME" sh
}

clean() {
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
    docker rmi "$IMAGE_NAME" 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete!${NC}"
}

usage() {
    echo "Usage: $0 {build|run|stop|logs|status|shell|clean|all}"
    echo ""
    echo "Commands:"
    echo "  build   - Build Docker image"
    echo "  run     - Run container (stops existing if running)"
    echo "  stop    - Stop and remove container"
    echo "  logs    - Show container logs (follow mode)"
    echo "  status  - Show container status"
    echo "  shell   - Open shell in container"
    echo "  clean   - Remove container and image"
    echo "  all     - Build and run"
    echo ""
    echo "Environment Variables:"
    echo "  PORT          - API port (default: 3333)"
    echo "  DATABASE_URL  - PostgreSQL connection string"
}

# Main
case "${1:-}" in
    build)
        build
        ;;
    run)
        run
        ;;
    stop)
        stop
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    shell)
        shell
        ;;
    clean)
        clean
        ;;
    all)
        build
        run
        ;;
    *)
        usage
        exit 1
        ;;
esac
