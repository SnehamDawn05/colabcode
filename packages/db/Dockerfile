FROM node:20-alpine AS base

# Setup pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install OpenSSL and libc for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @colab-code/db generate

WORKDIR /app/packages/db

CMD ["sh", "-c", "pnpm db:push --accept-data-loss && pnpm db:seed"]
