FROM node:22-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies for all workspaces
RUN npm install

# Copy source code
COPY . .

# Build client and server
RUN npm run build

# Hugging Face Spaces default non-root user (UID 1000)
USER node

# Port
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/dist/index.js"]

