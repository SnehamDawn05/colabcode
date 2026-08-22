FROM node:20-alpine AS base

# Setup pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install OpenSSL and libc for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
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

# Generate Prisma client
RUN pnpm --filter @colab-code/db generate

WORKDIR /app/packages/db

CMD ["sh", "-c", "pnpm db:push --accept-data-loss && pnpm db:seed"]
