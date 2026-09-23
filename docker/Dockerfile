FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/docker ./docker
COPY --from=build /app/lib/airbnb/normalize.ts ./lib/airbnb/normalize.ts
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
EXPOSE 3000
CMD ["node", "docker/server.mjs"]
