FROM node:22-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY medusa-agency-boilerplate-storefront/package.json medusa-agency-boilerplate-storefront/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ARG MEDUSA_BACKEND_URL=http://127.0.0.1:9000
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://127.0.0.1:9000
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_build_placeholder
ARG NEXT_PUBLIC_BASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_DEFAULT_REGION=ru
ARG PAYLOAD_ENABLED=false
ARG PAYLOAD_CMS_URL=http://127.0.0.1:3100

ENV MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL
ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION
ENV PAYLOAD_ENABLED=$PAYLOAD_ENABLED
ENV PAYLOAD_CMS_URL=$PAYLOAD_CMS_URL

COPY --from=deps /app/node_modules ./node_modules
COPY medusa-agency-boilerplate-storefront/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV STOREFRONT_PORT=8000

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && chown -R node:node /app

COPY --from=builder --chown=node:node /app /app

USER node

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1:${STOREFRONT_PORT:-8000}/ >/dev/null || exit 1

CMD ["npm", "run", "start"]
