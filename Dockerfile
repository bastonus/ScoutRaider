# ─────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for ScoutRaider Web & Backend Engine
# Production deployment with Coolify & PostgreSQL
# ─────────────────────────────────────────────────────────────

# Stage 1: Build the Vite Single-Page Application
FROM node:20-alpine AS builder

WORKDIR /app

ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

COPY package*.json ./
RUN npm ci || npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Stage 2: Production Python 3.12 Debian with Nginx & WeasyPrint
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONPATH=/app \
    DATABASE_URL="postgres://postgres:MOED1tbZpPwzb1llUs74g8hVY62T8WiAyeroiOJxl5QVcL8sTM4cvZbRAZpC7Lm7@dqitb10gzxtpiejn4kj3ub9b:5432/postgres"

# Install system dependencies (WeasyPrint, fonts, Nginx, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-dejavu-core \
    fonts-liberation \
    fontconfig \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend and Legacy Modules
COPY backend /app/backend
COPY legacy/modules /app/legacy/modules

# Copy compiled frontend from Stage 1 into Nginx HTML dir
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx config & runner script
COPY nginx.conf /etc/nginx/sites-available/default
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

CMD ["/app/start.sh"]
