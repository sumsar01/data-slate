FROM oven/bun:1.1.38 AS base
WORKDIR /app

COPY package.json ./
RUN bun install

COPY src/ ./src/

ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
