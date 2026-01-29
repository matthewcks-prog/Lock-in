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
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force && \
    mkdir -p backend/node_modules

# -----------------------------------------------------------------------------
# Stage 2: Production - Minimal runtime image
# -----------------------------------------------------------------------------
FROM node:20.18-alpine

# Install runtime dependencies and create non-root user
# FFmpeg: fallback for transcription (ffmpeg-static should work, but belt-and-suspenders)
# curl: required for health checks
RUN apk add --no-cache ffmpeg curl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /tmp/transcripts && \
    chown nodejs:nodejs /tmp/transcripts

WORKDIR /app

# Copy hoisted node_modules from builder with correct ownership
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
# Copy nested backend node_modules (if any exist)
COPY --from=builder --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules

# Copy backend application code to /app/backend (Preserve monorepo structure)
COPY --chown=nodejs:nodejs backend/ ./backend/

# Copy required core config files
COPY --chown=nodejs:nodejs core/config/chatLimits.json ./core/config/chatLimits.json

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
CMD ["node", "backend/index.js"]
