# Docker Setup Guide

**AI PAJAK** - API 서버 Docker 설정 가이드

**Last Updated**: 2026-01-03

---

## Overview

| 항목 | 값 |
|-----|-----|
| Base Image | `node:22-alpine` (LTS) |
| API Port | `3333` |
| Build Type | Multi-stage (최적화된 이미지 크기) |

---

## Quick Start

### 방법 1: Docker Compose (권장)

```bash
# 전체 스택 실행 (PostgreSQL + API)
docker compose up -d

# API만 실행 (PostgreSQL이 이미 실행 중인 경우)
docker compose up -d api

# 로그 확인
docker compose logs -f api

# 중지
docker compose down
```

### 방법 2: Docker만 사용

```bash
# 1. 이미지 빌드
docker build -t ai-pajak-api -f apps/api/Dockerfile .

# 2. 컨테이너 실행
docker run -d \
  --name ai-pajak-api \
  -p 3333:3333 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/ai_pajak?schema=public" \
  -e PORT=3333 \
  ai-pajak-api
```

---

## 파일 구조

```
ai-pajak/
├── docker-compose.yml          # Docker Compose 설정
├── .dockerignore               # Docker 빌드 제외 파일
└── apps/api/
    └── Dockerfile              # API 서버 Dockerfile
```

---

## Docker Compose Services

### 1. PostgreSQL (`postgres`)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_pajak
```

### 2. API Production (`api`)

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3333:3333"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/ai_pajak
```

### 3. API Development (`api-dev`)

Hot reload가 활성화된 개발 모드:

```bash
# 개발 모드로 실행 (--profile dev 필요)
docker compose --profile dev up -d api-dev
```

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|-----|-------|------|
| `PORT` | `3333` | API 서버 포트 |
| `DATABASE_URL` | - | PostgreSQL 연결 문자열 |
| `NODE_ENV` | `production` | 실행 환경 |

---

## Dockerfile 상세

### Multi-stage Build

```
Stage 1: deps      → 의존성 설치 + Prisma Client 생성
Stage 2: builder   → TypeScript 빌드
Stage 3: runner    → 프로덕션 실행 (최소 이미지)
```

### 보안 설정

- Non-root user (`nestjs:nodejs`) 사용
- Health check 내장 (`/health` 엔드포인트)
- 필요한 파일만 복사

---

## 개발 워크플로우

### 로컬 개발 (Docker 없이)

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_pajak?schema=public"' > .env
cp .env apps/api/.env

# 3. 개발 서버 실행
npm run dev:api
```

### Docker 개발 모드

```bash
# PostgreSQL + API (hot reload)
docker compose --profile dev up -d postgres api-dev

# 로그 확인
docker compose logs -f api-dev
```

### Docker 프로덕션 빌드

```bash
# 빌드 및 실행
docker compose up -d --build api

# 이미지 크기 확인
docker images ai-pajak-api
```

---

## 자주 사용하는 명령어

```bash
# 컨테이너 상태 확인
docker compose ps

# API 로그 확인
docker compose logs -f api

# 컨테이너 재시작
docker compose restart api

# 이미지 재빌드
docker compose up -d --build api

# 전체 정리 (볼륨 포함)
docker compose down -v

# 컨테이너 쉘 접속
docker compose exec api sh
```

---

## Health Check

API 서버는 `/health` 엔드포인트를 제공합니다:

```bash
curl http://localhost:3333/health
```

응답:
```json
{
  "status": "ok",
  "timestamp": "2026-01-03T12:00:00.000Z",
  "uptime": 123.456
}
```

---

## Troubleshooting

### Error: Cannot connect to database

**원인**: PostgreSQL 컨테이너가 준비되지 않음

**해결**:
```bash
# PostgreSQL 상태 확인
docker compose ps postgres

# 로그 확인
docker compose logs postgres

# 수동으로 health check
docker compose exec postgres pg_isready -U postgres
```

### Error: Port 3333 already in use

**해결**:
```bash
# 포트 사용 프로세스 확인
lsof -i :3333

# 다른 포트 사용
PORT=3334 docker compose up -d api
```

### 이미지 빌드 실패

**해결**:
```bash
# 캐시 없이 재빌드
docker compose build --no-cache api

# Docker 시스템 정리
docker system prune -f
```

---

## CI/CD 배포

### GitHub Actions 예시

```yaml
- name: Build and Push to ECR
  run: |
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    docker build -t $ECR_REGISTRY/ai-pajak-api:$GITHUB_SHA \
      -f apps/api/Dockerfile .
    docker push $ECR_REGISTRY/ai-pajak-api:$GITHUB_SHA
```

### ECS Fargate 배포

```bash
aws ecs update-service \
  --cluster ai-pajak-cluster \
  --service ai-pajak-api \
  --force-new-deployment
```

---

## Next Steps

- [Development Setup](development-setup.md) - 로컬 개발 환경 설정
- [Architecture](../CLAUDE.md) - 프로젝트 아키텍처

---

**Questions?** Docker 설정 중 문제가 있으면 팀에 문의하세요.
