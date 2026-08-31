# syntax=docker/dockerfile:1.6

########## deps (todas, pra build) ##########
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

########## builder ##########
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/public
ENV NEXT_TELEMETRY_DISABLED=1
ENV POSTGRES_URL="postgres://build:build@localhost:5432/build"
RUN npm run build

########## deps-prod (só runtime) ##########
FROM node:20-alpine AS depsprod
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

########## runner ##########
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Dependências de runtime instaladas de verdade (com transitivos)
COPY --from=depsprod --chown=nextjs:nodejs /app/node_modules ./node_modules

# Package.json e artefatos de banco (schema/seed/drizzle config)
COPY --chown=nextjs:nodejs package.json ./package.json
COPY --chown=nextjs:nodejs drizzle.config.ts ./drizzle.config.ts
COPY --chown=nextjs:nodejs tsconfig.json ./tsconfig.json
COPY --chown=nextjs:nodejs db ./db

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Diretório persistente pra uploads
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data
VOLUME ["/data"]

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
