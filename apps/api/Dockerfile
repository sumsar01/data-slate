FROM oven/bun:latest AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY src/ ./src/

ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
