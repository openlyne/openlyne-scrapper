# Production image
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install deps separate layer
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src
COPY .env.example ./

EXPOSE 3000
CMD ["node", "src/server.js"]
