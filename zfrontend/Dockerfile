# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY public/ ./public/
COPY src/ ./src/

# Frontend Environment Variables
# These must be injected during build time for React apps
ARG REACT_APP_API_URL
ARG REACT_APP_SOCKET_URL
ARG REACT_APP_LIVEKIT_URL

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL
ENV REACT_APP_LIVEKIT_URL=$REACT_APP_LIVEKIT_URL

RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Replace default Nginx config to support client-side routing
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
