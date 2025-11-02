# Multi-stage build for production

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code (needed for vite build)
COPY client ./client
COPY shared ./shared
COPY attached_assets ./attached_assets
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./

# Build frontend ONLY (not server)
RUN npx vite build

# Stage 2: Production runtime
FROM node:20-alpine AS production
WORKDIR /app

# Install git (required for Meta-SySop to commit/push changes)
RUN apk add --no-cache git

# Install production dependencies + drizzle-kit for migrations
COPY package*.json ./
RUN npm ci
RUN npm install drizzle-kit@^0.31.4

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

# Copy server code (TypeScript)
COPY server ./server
COPY shared ./shared
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# CRITICAL: Copy replit.md for Meta-SySop platform knowledge
COPY replit.md ./

# Copy startup script and database setup scripts
COPY railway-start.sh ./
COPY drop-old-tables.js ./
COPY create-healing-tables.sql ./
RUN chmod +x railway-start.sh

# Expose port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Run migrations then start the server
CMD ["./railway-start.sh"]
