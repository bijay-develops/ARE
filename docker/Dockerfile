# ─── Stage 1: build ───────────────────────────────────────────────────────────
# Compiles TypeScript (tsc) and bundles the React client (esbuild).
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

RUN npm run build:server \
 && npm run build:client

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
# Slim image with production deps + compiled output only.
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Compiled engine + client bundle
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Writable dirs for SSG output, FS cache and metrics (also mounted as volumes)
RUN mkdir -p public/ssg .cache experiments/results/raw-data

EXPOSE 3000
CMD ["node", "dist/server/server.js"]
