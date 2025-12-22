# Multi-stage build - compile native modules in Alpine for compatibility
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk update && apk add --no-cache python3 make g++

# Copy package files
COPY application/package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY application/ ./

# Build the application
RUN npm run build

# Production stage - minimal runtime image
FROM node:22-alpine

WORKDIR /app

# Copy only the built output from builder stage
COPY --from=builder /app/.output ./.output

# Create data directory and set up non-root user
RUN mkdir -p /app/.data && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Set environment to production
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Expose the application port
EXPOSE 3000

# Run as non-root user
USER nodejs

# Run the application
CMD ["node", ".output/server/index.mjs"]
