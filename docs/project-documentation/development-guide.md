# 개발 가이드

## 개요

AI Pajak 개발 환경 설정 및 로컬 개발 가이드입니다.

## 사전 요구사항

| 도구 | 버전 | 설명 |
|------|------|------|
| Node.js | >= 18.x | JavaScript 런타임 |
| npm | >= 9.x | 패키지 매니저 |
| PostgreSQL | >= 14.x | 데이터베이스 |
| Docker | >= 20.x | 컨테이너화 (선택) |

## 빠른 시작

### 1. 의존성 설치

```bash
# 루트에서 모든 워크스페이스 의존성 설치
npm install
```

### 2. 환경 변수 설정

```bash
# .env 파일 생성 (루트 또는 apps/api)
cp .env.example .env
```

필수 환경 변수:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_pajak?schema=public"

# API (선택)
PORT=3000

# PaddleOCR Service (마이그레이션 예정)
PADDLEOCR_SERVICE_URL="http://localhost:8080"
```

### 3. 데이터베이스 설정

```bash
# Prisma 클라이언트 생성
npm run prisma:generate

# 마이그레이션 실행
cd apps/api && npm run prisma:migrate
```

### 4. 개발 서버 시작

```bash
# API + Web 동시 실행
npm run dev

# 또는 개별 실행
npm run dev:api   # API only (port 3000)
npm run dev:web   # Web only (port 5173)
```

## 데이터베이스 마이그레이션

### PostgreSQL 설치 (macOS)

```bash
brew install postgresql@14
brew services start postgresql@14
```

### 데이터베이스 생성

```bash
# PostgreSQL 접속
psql postgres

# 데이터베이스 및 사용자 생성
CREATE DATABASE ai_pajak;
CREATE USER ai_pajak_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ai_pajak TO ai_pajak_user;
\q
```

### 마이그레이션 실행

```bash
cd apps/api

# 개발 환경 마이그레이션 (스키마 변경 시)
npm run prisma:migrate

# 또는 직접 Prisma CLI 사용
npx prisma migrate dev --name "migration_name"
```

### 마이그레이션 상태 확인

```bash
npx prisma migrate status
```

### Prisma Studio (DB 브라우저)

```bash
npm run prisma:studio
# http://localhost:5555 에서 확인
```

## Docker 설정

### API 서버용 Dockerfile

`apps/api/Dockerfile` 생성:

```dockerfile
# apps/api/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 루트 package.json 복사
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY prisma ./prisma/

# 의존성 설치
RUN npm ci --workspace=apps/api

# Prisma 클라이언트 생성
RUN npx prisma generate

# 소스 복사 및 빌드
COPY apps/api ./apps/api/
RUN npm run build:api

# Production 이미지
FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
```

### docker-compose.yml

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:14-alpine
    container_name: ai-pajak-db
    environment:
      POSTGRES_USER: ai_pajak_user
      POSTGRES_PASSWORD: your_password
      POSTGRES_DB: ai_pajak
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ai_pajak_user -d ai_pajak"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: ai-pajak-api
    environment:
      DATABASE_URL: "postgresql://ai_pajak_user:your_password@db:5432/ai_pajak?schema=public"
      PORT: 3000
      PADDLEOCR_SERVICE_URL: "http://ocr:8080"
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
      ocr:
        condition: service_started

  ocr:
    image: paddlepaddle/paddle:2.5.1
    container_name: ai-pajak-ocr
    build:
      context: ./services/ocr
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    volumes:
      - ./services/ocr:/app
    command: python app.py

volumes:
  postgres_data:
```

### Docker 명령어

```bash
# 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f api

# 마이그레이션 실행 (컨테이너 내부)
docker-compose exec api npx prisma migrate deploy

# 중지
docker-compose down

# 볼륨 포함 삭제
docker-compose down -v
```

## 스크립트 참조

### 루트 레벨

| 스크립트 | 설명 |
|---------|------|
| `npm run dev` | API + Web 동시 실행 |
| `npm run dev:api` | API 개발 서버 |
| `npm run dev:web` | Web 개발 서버 |
| `npm run build:api` | API 빌드 |
| `npm run build:web` | Web 빌드 |
| `npm run prisma:generate` | Prisma 클라이언트 생성 |
| `npm run prisma:studio` | Prisma Studio 실행 |

### apps/api

| 스크립트 | 설명 |
|---------|------|
| `npm run start:dev` | 개발 서버 (watch mode) |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint 실행 |
| `npm run test` | Jest 테스트 |
| `npm run prisma:migrate` | 마이그레이션 실행 |

## 테스트

```bash
cd apps/api

# 단위 테스트
npm run test

# 커버리지
npm run test:cov

# Watch 모드
npm run test:watch
```

## API 문서

개발 서버 실행 후 Swagger UI 접속:

```
http://localhost:3000/swagger
```

## 트러블슈팅

### Prisma 클라이언트 오류

```bash
# 클라이언트 재생성
npm run prisma:generate
```

### BigInt JSON 직렬화 오류

`main.ts`에 패치가 적용되어 있는지 확인:

```typescript
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
```

### 포트 충돌

```bash
# 사용 중인 포트 확인
lsof -i :3000
lsof -i :5173

# 프로세스 종료
kill -9 <PID>
```

## 다음 단계

- [ ] Docker 설정 파일 생성
- [ ] CI/CD 파이프라인 구성
- [ ] 테스트 커버리지 향상
- [ ] shadcn/ui 컴포넌트 도입
