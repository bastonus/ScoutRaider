#!/bin/bash
set -e

echo "==> Running Alembic migrations..."
cd /app && alembic upgrade head

echo "==> Starting ScoutRaider FastAPI Backend Engine..."
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "==> Starting Nginx HTTP Gateway on port 80..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Exit when either process exits (requires bash >= 4.3)
wait -n $BACKEND_PID $NGINX_PID
