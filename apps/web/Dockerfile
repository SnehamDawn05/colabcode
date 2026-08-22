# ── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy root workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

# Copy all package manifests
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/validation/package.json ./packages/validation/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
COPY apps/realtime/package.json ./apps/realtime/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY packages/validation ./packages/validation
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

# Generate Prisma client and build packages
RUN pnpm --filter @colab-code/db generate
RUN pnpm --filter @colab-code/shared build
RUN pnpm --filter @colab-code/validation build
RUN pnpm --filter @colab-code/ui build
RUN pnpm --filter @colab-code/db build

# Disable Next telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build web application
RUN pnpm --filter @colab-code/web build

# ── Stage 2: Runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache libc6-compat openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public directory and build artifacts
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
