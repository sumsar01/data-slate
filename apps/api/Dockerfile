FROM oven/bun:latest AS base
WORKDIR /app

# Copy monorepo root manifest and lockfile
COPY root-package.json ./package.json
COPY bun.lock ./

# Copy workspace packages needed by the API
COPY packages/shared ./packages/shared
COPY package.json ./apps/api/package.json

RUN bun install --filter api

# Copy API source
COPY src ./apps/api/src

ENV NODE_ENV=production
EXPOSE 3001

WORKDIR /app/apps/api
CMD ["bun", "run", "src/index.ts"]
