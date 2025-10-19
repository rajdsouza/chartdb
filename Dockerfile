# 1) Build stage: install deps and build frontend
FROM node:22-alpine AS builder

ARG VITE_OPENAI_API_KEY
ARG VITE_OPENAI_API_ENDPOINT
ARG VITE_LLM_MODEL_NAME
ARG VITE_HIDE_CHARTDB_CLOUD
ARG VITE_DISABLE_ANALYTICS
ARG VITE_STORAGE_BACKEND=server

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Inject Vite build-time vars
RUN echo "VITE_OPENAI_API_KEY=${VITE_OPENAI_API_KEY}" > .env && \
    echo "VITE_OPENAI_API_ENDPOINT=${VITE_OPENAI_API_ENDPOINT}" >> .env && \
    echo "VITE_LLM_MODEL_NAME=${VITE_LLM_MODEL_NAME}" >> .env && \
    echo "VITE_HIDE_CHARTDB_CLOUD=${VITE_HIDE_CHARTDB_CLOUD}" >> .env && \
    echo "VITE_DISABLE_ANALYTICS=${VITE_DISABLE_ANALYTICS}" >> .env && \
    echo "VITE_STORAGE_BACKEND=${VITE_STORAGE_BACKEND}" >> .env

RUN npm run build

# Prune devDependencies for runtime
RUN npm prune --omit=dev

# 2) Runtime stage: run Node server that serves API + static
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    API_PORT=8081 \
    FRONTEND_PORT=8080 \
    DB_PATH=/data/chartdb.sqlite \
    STATIC_DIR=/usr/src/app/dist \
    API_BASE=http://localhost:8081

WORKDIR /usr/src/app

# Copy production node_modules (native modules compiled in builder)
COPY --from=builder /usr/src/app/node_modules ./node_modules
# Copy server and built frontend
COPY --from=builder /usr/src/app/server ./server
COPY --from=builder /usr/src/app/dist ./dist
COPY package.json ./package.json

# Create data dir for sqlite
RUN mkdir -p /data

EXPOSE 8080 8081

CMD ["node", "server/index.mjs"]