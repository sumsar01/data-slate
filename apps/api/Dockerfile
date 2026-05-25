FROM oven/bun:latest AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
RUN bun install --filter api

COPY apps/api/src/ ./apps/api/src/

ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "run", "apps/api/src/index.ts"]
