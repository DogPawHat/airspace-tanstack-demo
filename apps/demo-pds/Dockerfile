FROM node:22-alpine AS build
RUN apk add --no-cache build-base python3
RUN npm install -g pnpm@11.24.0
WORKDIR /app
# Built from the repo root (see fly.toml: `dockerfile: 'apps/demo-pds/Dockerfile'`).
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/demo-pds/package.json apps/demo-pds/package.json
RUN pnpm --filter airspace-demo-pds install --prod --frozen-lockfile

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY apps/demo-pds/server.mjs apps/demo-pds/invite.mjs apps/demo-pds/reset.mjs apps/demo-pds/smoke.mjs ./
ENV NODE_ENV=production
ENV PDS_PORT=3000
ENV PDS_DATA_DIRECTORY=/data
ENV PDS_BLOBSTORE_DISK_LOCATION=/data/blobs
VOLUME /data
EXPOSE 3000
CMD ["node", "server.mjs"]
