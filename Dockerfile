# Stage 1: Build the application
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the production image
FROM node:20-slim

# --- BLOQUE CRÍTICO PARA RASPBERRY PI ---
# Instalamos Chromium del sistema operativo (que sí es compatible con ARM)
# y las librerías gráficas necesarias.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && apt-get install -y chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Variables de entorno para que Puppeteer use el Chromium que acabamos de instalar
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# ----------------------------------------

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the built application from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD [ "node", "dist/src/main.js" ]