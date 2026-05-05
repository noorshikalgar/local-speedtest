# Stage 1: Build the React frontend
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Production image
FROM node:20-bookworm-slim

# Required to compile better-sqlite3 native bindings and install Ookla Speedtest CLI.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl python3 make g++ \
  && curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | bash \
  && apt-get install -y --no-install-recommends speedtest \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies (includes tsx for running TypeScript)
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Copy backend source
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/tsconfig.json

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Data directory — mount a volume here to persist the SQLite database
RUN mkdir -p /app/backend/data

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["./backend/node_modules/.bin/tsx", "backend/src/index.ts"]
