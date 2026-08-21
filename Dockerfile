# ── Stage 1: Build React + Vite app ──
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . ./

# Build-time backend URL — leave empty to use nginx proxy (relative URLs).
# Override when deploying frontend separately from backend, e.g.:
#   docker build --build-arg VITE_API_BASE_URL=https://api.yourdomain.com
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# ── Stage 2: Serve static files with Nginx ──
FROM nginx:1.27-alpine AS production

# nginx:alpine's entrypoint processes *.template files in /etc/nginx/templates/
# at startup using envsubst — so BACKEND_URL is injected at runtime, not build time.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built assets from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Default backend URL when running via Docker Compose (service name = "backend")
ENV BACKEND_URL=http://backend:4008

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
