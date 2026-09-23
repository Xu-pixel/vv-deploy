# syntax=docker/dockerfile:1

# One pinned slim image for install, build, and runtime.
FROM oven/bun:1.4.2-slim AS bun
WORKDIR /app

FROM docker:27-cli AS dockercli

FROM bun AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun --bun next build

FROM bun AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static
COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/scripts ./scripts
COPY --from=builder --chown=bun:bun /app/db ./db
COPY --from=builder --chown=bun:bun /app/lib ./lib
# migrate / bun scripts import yaml from source (not Next standalone)
COPY --from=deps --chown=bun:bun /app/node_modules/yaml ./node_modules/yaml

EXPOSE 3000
USER bun
CMD ["bun", "server.js"]
