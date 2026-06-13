FROM node:18-slim

WORKDIR /usr/src/app

# Install ALL dependencies (incl. dev) so the TypeScript build can run.
# Cached layer separate from source code.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source with correct ownership so non-root user can read files
COPY --chown=node:node . .

# Compile the TypeScript reference modules (src/ -> dist/) used by the catalog
# module when USE_TS_CATALOG=true. Then drop devDependencies to slim the image.
RUN npm run build:ts
RUN npm prune --omit=dev

# Cloud Run requires port 8080
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Run as non-root for security
USER node

CMD ["npm", "start"]
