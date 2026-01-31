# Dockerfile for WebSocket server deployment to Railway
FROM node:22-slim

WORKDIR /app

# Copy lib files needed for bundling
COPY lib ./lib

# Copy websocket-server files
COPY websocket-server ./websocket-server

# Install dependencies and build
WORKDIR /app/websocket-server
RUN npm install && npm run build

# Copy package.json to /app root (Railway may look for it here)
WORKDIR /app
COPY websocket-server/package.json ./package.json

# Expose port and start
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production
CMD ["node", "websocket-server/dist/server.js"]
