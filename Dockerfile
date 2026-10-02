FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=rebuild_ca \
    if [ -f /run/secrets/rebuild_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/rebuild_ca; fi; \
    npm ci --fetch-retries=0 --fetch-timeout=20000 --loglevel=http
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production NODE_USE_ENV_PROXY=1 PORT=3000 QUOTA_DB=/app/.data/quota.sqlite
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=rebuild_ca \
    if [ -f /run/secrets/rebuild_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/rebuild_ca; fi; \
    npm ci --omit=dev --fetch-retries=0 --fetch-timeout=20000 --loglevel=http && mkdir -p /app/.data && chown -R node:node /app/.data
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.mjs"]
