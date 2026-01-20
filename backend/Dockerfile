# =============================================================================
# Lock-in Backend - Production Dockerfile
# Multi-stage build for optimal image size and security
#
# BUILD CONTEXT: Must be project root (not /backend) because config.js
# imports ../core/config/chatLimits.json
#
# Build from project root:
#   docker build -f backend/Dockerfile -t lock-in-backend .
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies
# -----------------------------------------------------------------------------
FROM node:20.18-alpine AS builder

WORKDIR /app

# Copy root workspace files (CRITICAL for npm workspaces)
# npm workspaces requires the root package.json and package-lock.json
COPY package*.json ./

# Copy backend workspace package files
COPY backend/package*.json ./backend/

# Install dependencies from root (hoisted structure)
# This ensures all workspace dependencies are resolved correctly
ENV NODE_ENV=production
RUN npm ci --omit=dev --ignore-scripts

# -----------------------------------------------------------------------------
# Stage 2: Production - Minimal runtime image
# -----------------------------------------------------------------------------
FROM node:20.18-alpine

# Install FFmpeg as fallback (ffmpeg-static should work, but belt-and-suspenders)
# Also install curl for health checks
RUN apk add --no-cache ffmpeg curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy hoisted node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy backend application code
COPY backend/ ./

# Copy required core config files (backend imports ../core/config/chatLimits.json)
# We place them relative to WORKDIR so the import path works
COPY core/config/chatLimits.json ../core/config/chatLimits.json

# Create temp directory for transcription jobs
RUN mkdir -p /tmp/transcripts && \
    chown -R nodejs:nodejs /tmp/transcripts && \
    chown -R nodejs:nodejs /app && \
    chown -R nodejs:nodejs /core

# Switch to non-root user
USER nodejs

# Environment configuration
# NOTE: NODE_ENV is NOT set here - it should be provided at runtime:
#   - docker-compose.yml sets it to 'development' for local testing
#   - Azure Container Apps sets it to 'development' (staging) or 'production'
ENV PORT=3000 \
    TRANSCRIPTION_TEMP_DIR=/tmp/transcripts

# Expose the application port
EXPOSE 3000

# Health check - verify the app responds
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "index.js"]
