# =========================
# Build stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build


# =========================
# Production stage
# =========================
FROM node:20-alpine

WORKDIR /app

# Prisma requires OpenSSL
RUN apk add --no-cache openssl

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled application
COPY --from=builder /app/dist ./dist

# Copy generated Prisma Client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma package
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema
COPY prisma ./prisma

EXPOSE 4000

CMD ["node", "dist/server.js"]