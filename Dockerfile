# ─────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for ScoutRaider Web
# Designed for production deployments (Coolify, Docker, Traefik)
# ─────────────────────────────────────────────────────────────

# Stage 1: Build the Vite Single-Page Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install clean dependencies
RUN npm ci

# Copy source code and configuration
COPY . .

# Build production assets (Vite generates /app/dist)
RUN npm run build

# Stage 2: Serve via high-performance Nginx Alpine
FROM nginx:alpine

# Remove default nginx html
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled SPA assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Coolify / Traefik targets port 80 by default
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
