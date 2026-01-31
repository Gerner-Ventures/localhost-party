# Dockerfile for WebSocket server deployment to Railway
FROM node:22-slim

WORKDIR /app

# Copy package files for websocket-server
COPY websocket-server/package*.json ./websocket-server/

# Install websocket-server dependencies
WORKDIR /app/websocket-server
RUN npm install

# Copy lib files needed for bundling
WORKDIR /app
COPY lib ./lib
COPY websocket-server ./websocket-server

# Build the bundled server
WORKDIR /app/websocket-server
RUN npm run build

# Start the server
WORKDIR /app
EXPOSE 8080
ENV PORT=8080
CMD ["node", "websocket-server/dist/server.js"]
