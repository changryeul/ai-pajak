# Development Environment Setup

**AI PAJAK** - 개발 환경 설정 가이드

**Last Updated**: 2026-01-03

---

## Prerequisites

시작하기 전에 다음이 설치되어 있어야 합니다:

- **Node.js**: v18.x 이상 (LTS 권장)
- **npm**: v9.x 이상
- **Docker**: PostgreSQL 컨테이너 실행용
- **Git**: 버전 관리

버전 확인:
```bash
node -v    # v18.x 이상
npm -v     # v9.x 이상
docker -v  # Docker version 24.x 이상
```

---

## Step 1: Repository Clone

```bash
git clone <repository-url>
cd ai-pajak
```

---

## Step 2: Install Dependencies

루트 디렉토리에서 모든 workspace 의존성을 설치합니다:

```bash
npm install
```

이 명령어는 다음을 설치합니다:
- 루트 devDependencies (prisma, typescript, concurrently)
- `apps/api` 의존성 (NestJS, Prisma Client 등)
- `apps/web` 의존성 (React, Vite 등)

---

## Step 3: PostgreSQL Database Setup

### 3.1 Docker로 PostgreSQL 실행 (이미 실행 중이라면 건너뛰기)

```bash
# PostgreSQL 컨테이너 실행
docker run -d \
  --name ai-pajak-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ai_pajak \
  -p 5432:5432 \
  postgres:16

# 컨테이너 상태 확인
docker ps
```

### 3.2 Database 생성

Docker 컨테이너가 이미 실행 중이라면, 데이터베이스를 생성합니다:

```bash
# 방법 1: docker exec로 직접 생성
docker exec -it ai-pajak-postgres psql -U postgres -c "CREATE DATABASE ai_pajak;"

# 방법 2: 컨테이너 이름이 다른 경우 (컨테이너 이름 확인 후)
docker ps  # 컨테이너 이름 확인
docker exec -it <container_name> psql -U postgres -c "CREATE DATABASE ai_pajak;"
```

**이미 존재하는 경우 에러가 나면 정상입니다.**

### 3.3 Database 연결 확인

```bash
# PostgreSQL 접속 테스트
docker exec -it ai-pajak-postgres psql -U postgres -d ai_pajak -c "\conninfo"
```

성공 시 출력:
```
You are connected to database "ai_pajak" as user "postgres" ...
```

---

## Step 4: Environment Variables Setup

### 4.1 루트 디렉토리에 .env 파일 생성

```bash
# 프로젝트 루트에서
cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_pajak?schema=public"
EOF
```

### 4.2 apps/api에 .env 파일 생성

```bash
# apps/api 디렉토리에도 동일하게 생성
cat > apps/api/.env << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_pajak?schema=public"
EOF
```

### 4.3 환경 변수 형식

```
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]?schema=public"
```

| 변수 | 기본값 | 설명 |
|-----|-------|------|
| USER | postgres | PostgreSQL 사용자 |
| PASSWORD | postgres | PostgreSQL 비밀번호 |
| HOST | localhost | 호스트 (Docker는 localhost) |
| PORT | 5432 | PostgreSQL 포트 |
| DATABASE | ai_pajak | 데이터베이스 이름 |

---

## Step 5: Prisma Setup & Database Migration

### 5.1 Prisma Client 생성

```bash
# Prisma Client 생성 (prisma/schema.prisma 기반)
npm run prisma:generate

# 또는 직접 실행
npx prisma generate
```

### 5.2 Database 테이블 생성 (Migration)

**개발 환경에서 마이그레이션 실행:**

```bash
# 마이그레이션 생성 및 적용
npx prisma migrate dev --name init

# 마이그레이션만 적용 (이미 마이그레이션 파일이 있는 경우)
npx prisma migrate deploy
```

**`migrate dev` 명령어가 하는 일:**
1. `prisma/schema.prisma`와 현재 DB 상태를 비교
2. 변경사항에 대한 마이그레이션 SQL 파일 생성
3. 마이그레이션 적용
4. Prisma Client 재생성

### 5.3 테이블 생성 확인

```bash
# Prisma Studio로 확인 (브라우저에서 DB 조회)
npx prisma studio
```

브라우저에서 `http://localhost:5555` 열림

**또는 직접 PostgreSQL에서 확인:**

```bash
docker exec -it ai-pajak-postgres psql -U postgres -d ai_pajak -c "\dt"
```

예상 출력:
```
           List of relations
 Schema |      Name      | Type  |  Owner
--------+----------------+-------+----------
 public | User           | table | postgres
 public | Company        | table | postgres
 public | TaxCase        | table | postgres
 public | WorkflowState  | table | postgres
 ...
```

---

## Step 6: Run Development Server

### 6.1 API + Web 동시 실행

```bash
npm run dev
```

### 6.2 개별 실행

```bash
# API만 실행 (NestJS - port 3000)
npm run dev:api

# Web만 실행 (Vite React - port 5173)
npm run dev:web
```

### 6.3 서버 확인

- **API**: http://localhost:3000
- **Swagger UI**: http://localhost:3000/swagger
- **Web**: http://localhost:5173

---

## Quick Start (TL;DR)

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_pajak?schema=public"' > .env
cp .env apps/api/.env

# 3. DB 생성 (Docker PostgreSQL 컨테이너가 실행 중인 경우)
docker exec -it <postgres_container_name> psql -U postgres -c "CREATE DATABASE ai_pajak;"

# 4. Prisma 마이그레이션
npx prisma generate
npx prisma migrate dev --name init

# 5. 개발 서버 실행
npm run dev
```

---

## Troubleshooting

### Error: P1001 - Can't reach database server

**원인**: PostgreSQL이 실행 중이지 않거나 연결 정보가 잘못됨

**해결**:
```bash
# Docker 컨테이너 상태 확인
docker ps

# 컨테이너가 없으면 시작
docker start ai-pajak-postgres

# 또는 새로 생성
docker run -d --name ai-pajak-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
```

### Error: P1003 - Database does not exist

**원인**: 데이터베이스가 생성되지 않음

**해결**:
```bash
docker exec -it ai-pajak-postgres psql -U postgres -c "CREATE DATABASE ai_pajak;"
```

### Error: prisma command not found

**원인**: npm install이 실행되지 않음

**해결**:
```bash
npm install
npx prisma --version
```

### Error: Migration failed - relation already exists

**원인**: 이미 테이블이 존재함

**해결**:
```bash
# DB 초기화 (주의: 모든 데이터 삭제됨)
npx prisma migrate reset

# 또는 강제 적용
npx prisma db push --force-reset
```

---

## Useful Commands

| 명령어 | 설명 |
|-------|------|
| `npm install` | 의존성 설치 |
| `npm run dev` | API + Web 개발 서버 실행 |
| `npm run dev:api` | API만 실행 |
| `npm run dev:web` | Web만 실행 |
| `npx prisma generate` | Prisma Client 생성 |
| `npx prisma migrate dev` | 마이그레이션 생성 및 적용 |
| `npx prisma migrate deploy` | 마이그레이션 적용만 |
| `npx prisma studio` | DB GUI 실행 |
| `npx prisma db push` | 스키마 직접 푸시 (마이그레이션 없이) |
| `npx prisma migrate reset` | DB 초기화 및 마이그레이션 재적용 |

---

## Next Steps

- [API Architecture](project-documentation/architecture-api.md) - API 구조 이해
- [ERD Documentation](ERD/README.md) - 데이터베이스 스키마
- [PRD Documentation](PRD/README.md) - 제품 요구사항

---

**Questions?** 개발 환경 설정 중 문제가 있으면 팀에 문의하세요.
