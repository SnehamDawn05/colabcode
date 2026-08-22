# ── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy root workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

# Copy package manifests
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/validation/package.json ./packages/validation/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
COPY apps/realtime/package.json ./apps/realtime/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY packages/validation ./packages/validation
COPY apps/realtime ./apps/realtime

# Generate Prisma client and build packages
RUN pnpm --filter @colab-code/db generate
RUN pnpm --filter @colab-code/shared build
RUN pnpm --filter @colab-code/validation build
RUN pnpm --filter @colab-code/db build
RUN pnpm --filter @colab-code/realtime build

# ── Stage 2: Runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV REALTIME_PORT=3001

RUN apk add --no-cache openssl libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 realtime

# Copy entire built workspace
COPY --from=builder --chown=realtime:nodejs /app ./

USER realtime

EXPOSE 3001

CMD ["node", "apps/realtime/dist/index.js"]
