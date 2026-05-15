FROM node:22-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY medusa-agency-boilerplate/package.json medusa-agency-boilerplate/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS builder

WORKDIR /app

ARG MEDUSA_ADMIN_BACKEND_URL=/

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV MEDUSA_ADMIN_BACKEND_URL=$MEDUSA_ADMIN_BACKEND_URL

COPY --from=deps /app/node_modules ./node_modules
COPY medusa-agency-boilerplate/ ./
RUN rm -rf .medusa public/admin && npm run build && mkdir -p public && cp -a .medusa/server/public/admin public/admin

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOME=/tmp/medusa-home
ENV NPM_CONFIG_CACHE=/tmp/npm-cache
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /tmp/medusa-home /tmp/npm-cache \
  && chown -R node:node /app /tmp/medusa-home /tmp/npm-cache

COPY --from=builder --chown=node:node /app /app
COPY --chown=node:node docker/medusa-backend/entrypoint.sh /usr/local/bin/medusa-backend-entrypoint
RUN chmod +x /usr/local/bin/medusa-backend-entrypoint

USER node

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1:9000/health >/dev/null || exit 1

ENTRYPOINT ["medusa-backend-entrypoint"]
CMD ["npm", "run", "start"]
