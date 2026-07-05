# --- backend deps (native module build needs python/make/g++ on alpine) ---
FROM node:20-alpine AS server-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# --- client build ---
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- final image ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/meridian.db
ENV PORT=34216

COPY --from=server-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./
COPY src ./src
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 34216
VOLUME /data

CMD ["node", "server.js"]
