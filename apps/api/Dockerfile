# ============================================
# AI Pajak API - Multi-stage Dockerfile
# ============================================
# Base image: Node 22 Alpine (LTS, small footprint)
# ============================================

# Stage 1: Dependencies & Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies for native modules (if needed)
RUN apk add --no-cache libc6-compat

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source files
COPY tsconfig.json ./
COPY apps/api ./apps/api/

# Build the NestJS application
RUN npm run build:api

# ============================================
# Stage 2: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install OpenSSL 3 for Prisma compatibility
RUN apk add --no-cache openssl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy only necessary files from builder
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json

# Set ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose port (configurable via environment)
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3333}/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]
