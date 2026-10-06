FROM node:24-bookworm-slim AS build
WORKDIR /workspace
RUN npm install -g pnpm@11.19.0
COPY . .
RUN pnpm install --frozen-lockfile --filter @workspace/api-server... --filter @workspace/db...
RUN pnpm --filter @workspace/api-server run build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace /workspace
WORKDIR /workspace/artifacts/api-server
RUN mkdir -p uploads && chown node:node uploads
USER node
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
ENTRYPOINT ["node", "/workspace/ops/app/entrypoint.mjs"]
