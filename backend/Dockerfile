# =============================================================================
# Lock-in Backend - Multi-stage Dockerfile
#
# Stages:
# 1. base: Shared system dependencies
# 2. deps: Install all dependencies (including dev)
# 3. development: Hot-reloading setup
# 4. production-deps: Prune devDependencies
# 5. production: Final runtime image
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base - Shared system dependencies
# -----------------------------------------------------------------------------
FROM node:20.18-alpine AS base
# Install system dependencies required for both dev and prod
# FFmpeg: transcription fallback
# curl: healthcheck
# python3/make/g++: build tools for native modules (if needed)
RUN apk add --no-cache ffmpeg curl python3 make g++

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Dependencies - Install ALL modules
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy root workspace files (required for npm workspaces)
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install ALL dependencies (including dev for nodemon)
# We use root node_modules for hoisted dependencies
RUN npm ci --include=dev --ignore-scripts && \
    mkdir -p backend/node_modules

# -----------------------------------------------------------------------------
# Stage 3: Development - Hot reloading
# -----------------------------------------------------------------------------
FROM base AS development

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy application code (will be mounted over in docker-compose, but good fallback)
COPY . .

# Setup development environment
ENV NODE_ENV=development
ENV PORT=3000

# Directory for temp transcripts
RUN mkdir -p /tmp/transcripts && chmod 777 /tmp/transcripts

WORKDIR /app/backend
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Stage 4: Production Deps - Prune dev dependencies
# -----------------------------------------------------------------------------
FROM deps AS production-deps
# Remove devDependencies to save space and reduce attack surface
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
# Stage 5: Production - Final Image
# -----------------------------------------------------------------------------
FROM base AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /tmp/transcripts && \
    chown nodejs:nodejs /tmp/transcripts

# Copy production node_modules
COPY --from=production-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=production-deps --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules

# Copy application code
COPY --chown=nodejs:nodejs backend/ ./backend/
COPY --chown=nodejs:nodejs core/config/chatLimits.json ./core/config/chatLimits.json

WORKDIR /app

# Switch to non-root user
USER nodejs

ENV NODE_ENV=production
ENV PORT=3000
ENV TRANSCRIPTION_TEMP_DIR=/tmp/transcripts

EXPOSE 3000

# Health check - verify the app responds
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "backend/index.js"]
