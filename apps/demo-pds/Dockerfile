FROM node:22-alpine AS build
RUN apk add --no-cache build-base python3
RUN npm install -g pnpm@11.24.0
WORKDIR /app
# Built from the repo root (see fly.toml: `dockerfile: 'Dockerfile'`).
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/demo-pds/package.json apps/demo-pds/package.json
RUN pnpm --filter airspace-demo-pds install --prod --frozen-lockfile

FROM node:22-alpine
WORKDIR /app
# pnpm workspace layout: the virtual store lives in the root node_modules/.pnpm,
# and apps/demo-pds/node_modules holds the package symlinks into it. Both are
# needed for `import '@atproto/pds'` to resolve — copying only /app/node_modules
# leaves server.mjs unable to find the package.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/demo-pds/node_modules ./apps/demo-pds/node_modules
COPY apps/demo-pds/server.mjs apps/demo-pds/invite.mjs apps/demo-pds/reset.mjs apps/demo-pds/smoke.mjs ./apps/demo-pds/
ENV NODE_ENV=production
ENV PDS_PORT=3000
ENV PDS_DATA_DIRECTORY=/data
ENV PDS_BLOBSTORE_DISK_LOCATION=/data/blobs
VOLUME /data
EXPOSE 3000
WORKDIR /app/apps/demo-pds
CMD ["node", "server.mjs"]
