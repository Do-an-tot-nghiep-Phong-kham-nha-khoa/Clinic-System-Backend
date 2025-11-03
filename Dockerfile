# syntax=docker/dockerfile:1

# Build lightweight Node runtime image
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy app source
COPY . .

# Expose app port
EXPOSE 3000

# Default command (production)
CMD ["node", "src/app.js"]
