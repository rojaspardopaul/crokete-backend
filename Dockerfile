FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm install --production --no-audit --no-fund

# Bundle app source
COPY . .

# Use port 8080 for Cloud Run
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Run as non-root user for security
USER node

CMD ["npm", "start"]