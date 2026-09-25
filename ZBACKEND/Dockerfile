FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

# Health check using the observability ready endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/v1/health || exit 1

# Provide default command for API, but this image can also be used for Worker
CMD ["npm", "run", "start"]
