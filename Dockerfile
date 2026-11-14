# ─────────────────────────────────────────────────────────────────────
# Dockerfile for ScoutRaider Web & Backend Engine
# Production deployment with Coolify & PostgreSQL
# dist/ is pre-built locally and committed — no Node build in Docker
# ─────────────────────────────────────────────────────────────────────

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

# Persistent data directory for SQLite DB (mount as volume in Coolify)
RUN mkdir -p /data && chmod 777 /data
VOLUME ["/data"]

# Install Python requirements
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend and Legacy Modules
COPY backend /app/backend
COPY legacy/modules /app/legacy/modules

# Copy pre-built frontend directly (no Node/npm needed in Docker)
RUN rm -rf /usr/share/nginx/html/*
COPY dist /usr/share/nginx/html

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
