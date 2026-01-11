# ============================================
# AI Pajak Web - Production Dockerfile
# ============================================

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm install

# Copy source files
COPY apps/web ./apps/web
COPY tsconfig.json ./

# Build the app
WORKDIR /app/apps/web
RUN npm run build

# Production stage - Nginx
FROM nginx:alpine

# Copy custom nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
