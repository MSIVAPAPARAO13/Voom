# Voom — Enterprise-Grade Peer-to-Peer Video Conferencing Platform

Voom is a comprehensive, multi-tenant SaaS video conferencing platform built on modern WebRTC, Socket.IO, and the MERN stack. It offers real-time audio/video communication, AI-driven insights, collaboration workspaces, and enterprise billing/entitlement structures in a scalable architecture.

## Overview

Voom goes beyond simple video calls. By integrating AI features, persistent workspaces, multi-tenancy organizations, and background task queues, Voom delivers a robust experience similar to Zoom or Microsoft Teams, designed for professional, scalable deployments.

## Architecture

Voom employs a scalable backend architecture optimized for real-time collaboration and compute-heavy background tasks.

### Local & Development Architecture
```
React Frontend (SPA)
       │
       ▼
Node.js Express API (Web Service) ──▶ MongoDB (Document & Vector Store)
       │
       ▼
Redis (Pub/Sub & Queue)
       │
       ▼
BullMQ Background Workers (AI & Transcription)
```

### Production Architecture (Prepared for Render)
```
                    INTERNET
                       │
                       ▼
              ┌────────────────┐
              │ React Frontend │ (Render Static Site)
              └────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Express API   │ (Render Web Service)
              └────────────────┘
                 │          │
                 ▼          ▼
          MongoDB Atlas    Redis (Managed Provider)
                 │          │
                 ▼          ▼
              ┌────────────────┐
              │  Worker        │ (Render Background Worker)
              └────────────────┘
```
**Realtime:** P2P WebRTC signaling is routed through the Socket.IO server, abstracted to support future upgrades to an SFU like LiveKit.

## Local Development & Environment Setup

### 1. External Dependencies Setup
**MongoDB Setup**:
- Install MongoDB locally or create a free tier cluster on **MongoDB Atlas**.
- Obtain your Connection String URI.

**Redis Setup**:
- Install Redis locally (Minimum v6.2 recommended) or use a managed provider (e.g. Upstash, Redis Cloud).
- Obtain your Redis Connection URI.

### 2. Environment Variables
*(Do not commit actual secrets! Use the provided `.env.example` templates)*

**Backend (`ZBACKEND/.env`)**:
```env
PORT=8000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/voom
JWT_ACCESS_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000

# Optional Providers
OPENAI_API_KEY=
ASSEMBLYAI_API_KEY=
STRIPE_WEBHOOK_SECRET=
LOG_LEVEL=info
SERVICE_NAME=voom-api
```

**Frontend (`zfrontend/.env`)**:
```env
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_SOCKET_URL=http://localhost:8000
```

### 3. Backend Startup
```bash
cd ZBACKEND
npm install
npm run dev
```

### 4. Worker Startup
To process AI and transcription tasks, run the worker in a separate terminal:
```bash
cd ZBACKEND
npm run worker
```

### 5. Frontend Startup
```bash
cd zfrontend
npm install
npm start
```

## Docker Startup (Production-Like Testing)

Voom is fully Dockerized for reproducible production-like testing. The provided `docker-compose.yml` orchestrates the API, Worker, Redis, and Frontend static build. 
*Note: MongoDB remains externally hosted.*

```bash
# Provide environment variables or export them locally
export MONGODB_URI="mongodb+srv://..."
export JWT_ACCESS_SECRET="secret"
export JWT_REFRESH_SECRET="refresh"

# Build and start all services
docker-compose build
docker-compose up -d
```
Access the frontend on `http://localhost:3000`.

## CI/CD Pipeline

Voom includes a fully automated GitHub Actions pipeline (`.github/workflows/ci.yml`).
On every push or pull request to `main`, the pipeline:
1. Installs all dependencies deterministically (`npm ci`).
2. Generates the Frontend production static build.
3. Initializes an ephemeral Redis service container.
4. Executes the full `tests/run_all.mjs` backend regression suite utilizing mocked API providers to prevent billing surprises.

## Render Deployment Preparation

The repository is configured with a `render.yaml` Blueprint defining three services:
1. `voom-frontend`: Static site serving the React application.
2. `voom-api`: Web Service running the Express application.
3. `voom-worker`: Background Worker digesting BullMQ queues.

Secrets must be securely provided in the Render dashboard and are explicitly excluded from Git.

## Observability & Health Endpoints

Voom features a robust logging pipeline utilizing a centralized JSON structured logger masking sensitive keys (Passwords, JWTs).

- **Liveness Endpoint:** `GET /api/v1/health` (Used by Docker Healthcheck)
- **Readiness Endpoint:** `GET /api/v1/health/ready` (Probes MongoDB & Redis without spamming queries)

## Security

Voom leverages advanced enterprise security logic:
- JWT Access & Refresh Token rotation.
- Strict Organization Tenant Isolation via Database Scoping.
- XSS Sanitization, Helmet Headers, and Rate Limiting.
- Real-time Authorization checks on all socket events.
- **Docker Security:** Containers run minimally layered Node Alpine images without `.env` inclusions.

## Known External-Provider Limitations

- **OpenAI / AssemblyAI**: By default, tests and development environments utilize `mock` configurations. Without valid paid API keys, intelligence and transcription processes will securely exit and log their limitations.
- **LiveKit**: Currently unconfigured; WebRTC connections cleanly fallback to native peer-to-peer (P2P).

## Testing

Voom features a comprehensive suite of integration and load tests located in the `tests/` directory.

To run the full regression suite manually:
```bash
cd tests
npm ci
node run_all.mjs
```

## Project Status

- Phase 1-16: Completed
- Phase 17: Docker, CI/CD, and Production Readiness Configured.
- **Final Status: READY FOR PHASE 18 (Final Deployment)**
