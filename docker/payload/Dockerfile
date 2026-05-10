FROM node:22-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY payload-cms/package.json payload-cms/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY payload-cms/ ./
RUN npm run payload:generate:types && npm run payload:generate:importmap && npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PAYLOAD_PORT=3100

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && chown -R node:node /app

COPY --from=builder --chown=node:node /app /app
COPY --chown=node:node docker/payload/entrypoint.sh /usr/local/bin/payload-entrypoint
RUN chmod +x /usr/local/bin/payload-entrypoint

USER node

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1:${PAYLOAD_PORT:-3100}/api/pages?limit=1 >/dev/null || exit 1

ENTRYPOINT ["payload-entrypoint"]
CMD ["npm", "run", "start"]
