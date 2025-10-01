# Production image
FROM node:20-alpine AS base

WORKDIR /app

# Environment
ENV NODE_ENV=production \
	PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false \
	PUPPETEER_CACHE_DIR=/home/pptr/.cache/puppeteer \
	PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install system dependencies required by Chromium (Puppeteer) on Alpine
RUN apk add --no-cache \
			chromium \
			nss \
			freetype \
			harfbuzz \
			ca-certificates \
			ttf-freefont \
			udev \
			bash

# Add user for running the app (avoid root)
RUN addgroup -S pptr && adduser -S pptr -G pptr
USER pptr

# Install deps separate layer (still needs to run as root for native if any, so switch temporarily)
USER root
COPY package*.json ./
RUN npm install --omit=dev && chown -R pptr:pptr node_modules

# Copy source code
COPY --chown=pptr:pptr src ./src
COPY --chown=pptr:pptr .env.example ./

USER pptr

EXPOSE 3000

# Healthcheck hitting /health (adjust interval as needed)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok) process.exit(1)}).catch(()=>process.exit(1))" || exit 1

CMD ["node", "src/server.js"]
