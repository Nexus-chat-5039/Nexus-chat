FROM node:22-alpine

WORKDIR /app

# Copy package files for dependency caching
COPY services/nexus-socket/package.json services/nexus-socket/package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source
COPY services/nexus-socket/src/ ./src/

# Expose the Socket.IO port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

USER node

CMD ["node", "src/index.js"]
