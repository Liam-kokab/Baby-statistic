# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json tsconfig.base.json ./
COPY common/ ./common/
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY mcp-server/package.json ./mcp-server/

RUN npm install

COPY client/ ./client/
COPY server/ ./server/
COPY mcp-server/ ./mcp-server/

RUN npm run build -w client && npm run build -w server && npm run build -w mcp-server && cp mcp-server/src/descriptions.json dist/mcp-server/descriptions.json

# ── Stage 2: production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV BABY_API_URL=http://localhost:80

RUN apk add --no-cache python3 make g++ unzip

COPY package.json tsconfig.base.json ./
COPY common/ ./common/
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY mcp-server/package.json ./mcp-server/

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY doc/ ./doc/
COPY index.js ./

VOLUME ["/app/data"]
EXPOSE 80 3001

HEALTHCHECK --interval=5m --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost/api/ping || exit 1

CMD ["node", "index.js"]
