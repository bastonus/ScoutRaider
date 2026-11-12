# ─────────────────────────────────────────────────────────────
# ScoutRaider Suite — Backend Core Engine Dockerfile
# Production-ready Debian image calibrated for WeasyPrint 68
# Compatible with Coolify, Docker Compose, Traefik
# ─────────────────────────────────────────────────────────────

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# Install WeasyPrint system dependencies (Cairo, Pango, GdkPixbuf) and fonts
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
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency requirements
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY backend /app/backend
COPY legacy/modules /app/legacy/modules

# Set Python path so `backend.app` resolves seamlessly
ENV PYTHONPATH=/app

EXPOSE 8000

# Health check for container orchestrators (Coolify / Docker)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start FastAPI server via Uvicorn
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
