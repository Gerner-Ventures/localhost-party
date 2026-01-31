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

# Copy built output and package.json to /app root
# Railway runs npm start from /app, so dist must be at /app/dist
WORKDIR /app
RUN cp -r /app/websocket-server/dist /app/dist
COPY websocket-server/package.json ./package.json
COPY websocket-server/package-lock.json ./package-lock.json

# Install production dependencies in /app for runtime
RUN npm ci --omit=dev

# Expose port and start
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production
CMD ["node", "websocket-server/dist/server.js"]
