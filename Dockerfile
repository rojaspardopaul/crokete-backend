# Node 22 LTS: Prisma 7 exige ^20.19 || ^22.12 || >=24. Con node:18-slim el
# `npm ci` de abajo aborta antes de instalar nada.
FROM node:22-slim

WORKDIR /usr/src/app

# Install ALL dependencies (incl. dev) so the TypeScript build can run.
# Cached layer separate from source code.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source with correct ownership so non-root user can read files
COPY --chown=node:node . .

# Genera el cliente Prisma y compila los módulos TypeScript (src/ -> dist/).
# `src/generated/prisma` no se versiona, así que el cliente TIENE que generarse
# aquí: sin eso, tsc no encontraría qué compilar. Después se descartan las
# devDependencies para adelgazar la imagen.
RUN npm run build:ts
RUN npm prune --omit=dev

# Railway inyecta PORT en tiempo de ejecución; api/index.js cae a 5000 si falta.
# EXPOSE es documentación, no una restricción.
ENV NODE_ENV=production
EXPOSE 8080

# Run as non-root for security
USER node

CMD ["npm", "start"]
