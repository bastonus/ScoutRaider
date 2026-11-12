#!/bin/sh
set -e

echo "==> Starting ScoutRaider FastAPI Backend Engine..."
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "==> Starting Nginx HTTP Gateway on port 80..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Exit when either process exits
wait -n $BACKEND_PID $NGINX_PID
