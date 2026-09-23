FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY collector/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY collector ./collector
COPY lib/airbnb/normalize.ts ./lib/airbnb/normalize.ts
# The image includes Node and matching browser binaries.
ENV NODE_ENV=production PORT=8080
USER pwuser
EXPOSE 8080
CMD ["node", "--experimental-strip-types", "collector/server.mjs"]
