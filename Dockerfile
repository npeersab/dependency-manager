# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: install deps, generate the Prisma client, build the Next app.
# ---------------------------------------------------------------------------
FROM node:22-bookworm AS build
WORKDIR /app

# Dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Full source + Prisma schema/migrations.
COPY . .

# Generate the Prisma client (downloads the SQLite query engine for this platform).
RUN npx prisma generate

# Production build (also typechecks).
RUN npm run build

# ---------------------------------------------------------------------------
# Production stage.
# ---------------------------------------------------------------------------
FROM node:22-bookworm AS production
WORKDIR /app
ENV NODE_ENV=production

# App artifacts + Prisma schema/migrations (the DB file itself is a volume).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# DATABASE_URL="file:./dev.db" resolves relative to prisma/ (the schema dir).
# Migrations run on boot (no-op if already applied); the DB persists via a volume.
ENV DATABASE_URL="file:./dev.db"
ENV PORT=8123
EXPOSE 8123

# "Check for updates" only makes outbound HTTP calls (GitHub Releases API for
# ghcr.io images, Docker Hub/quay for the rest). No Docker socket or CLI needed.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 8123"]
