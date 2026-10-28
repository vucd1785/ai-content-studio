# Render spike P0-05 — Node 24 + Chrome Headless Shell (Remotion 4)
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

RUN corepack enable

ENV NODE_ENV=development

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/video/package.json apps/video/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/

RUN pnpm install --frozen-lockfile

COPY apps/video/src apps/video/src
COPY apps/video/scripts apps/video/scripts
COPY apps/video/remotion.config.ts apps/video/
COPY apps/video/tsconfig.json apps/video/
COPY apps/video/tests apps/video/tests
COPY apps/video/vitest.config.ts apps/video/
COPY apps/video/fixtures apps/video/fixtures
COPY packages/contracts/src packages/contracts/src
COPY fixtures/script.edu.json fixtures/

WORKDIR /workspace/apps/video
RUN pnpm run remotion:browser

ENV DATA_DIR=/data

CMD ["node", "scripts/render-spike.mjs"]
