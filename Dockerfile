FROM node:18-slim

WORKDIR /usr/src/app

# Install dependencies (cached layer separate from source code)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy source with correct ownership so non-root user can read files
COPY --chown=node:node . .

# Cloud Run requires port 8080
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Run as non-root for security
USER node

CMD ["npm", "start"]
