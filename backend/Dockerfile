# Use lightweight Node Alpine image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package management files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy server code
COPY server.js ./

# Expose backend port
EXPOSE 8080

# Configure environment defaults
ENV PORT=8080
ENV NODE_ENV=production

# Run start script
CMD ["npm", "start"]
