# Voom — Enterprise-Grade Peer-to-Peer Video Conferencing Platform

Voom is a comprehensive, multi-tenant SaaS video conferencing platform built on modern WebRTC, Socket.IO, and the MERN stack. It offers real-time audio/video communication, AI-driven insights, collaboration workspaces, and enterprise billing/entitlement structures in a scalable architecture.

## Overview

Voom goes beyond simple video calls. By integrating AI features, persistent workspaces, multi-tenancy organizations, and background task queues, Voom delivers a robust experience similar to Zoom or Microsoft Teams, designed for professional, scalable deployments.

## Key Features

- **Authentication**: JWT-based login with refresh-token rotation and strict session families.
- **Multi-Tenancy**: Organization-based partitioning, RBAC (Role-Based Access Control), and strict tenant isolation.
- **Video Meetings**: Low-latency P2P WebRTC capabilities with graceful fallback architecture.
- **Chat**: Persistent, real-time messaging using Socket.IO.
- **Workspace**: Interactive collaboration tools including notes, agendas, and resource management.
- **Recording**: Meeting recordings triggered securely through the platform.
- **Transcription**: Automated transcription of meeting recordings via AI providers.
- **AI Insights**: Automated meeting summaries, action items, and knowledge extraction.
- **Voom Memory (Ask Voom)**: RAG (Retrieval-Augmented Generation) based vector search across organizational transcripts and knowledge chunks.
- **Realtime Scaling**: Socket.IO clustered events with Redis Pub/Sub adapter.
- **Background Processing**: BullMQ job queues for heavy tasks (transcription, intelligence, and indexing).
- **Billing**: Multi-tiered subscription models, strict usage tracking, and automated entitlements.
- **Security**: Robust threat modeling, sanitization, Helmet headers, error masking, and rate limiting.

## Architecture

Voom employs a scalable backend architecture optimized for real-time collaboration and compute-heavy background tasks.

```
React Frontend (SPA)
       │
       ▼
Node.js Express API (Web Service) ──▶ MongoDB Atlas (Document & Vector Store)
       │
       ▼
Redis (Pub/Sub & Queue)
       │
       ▼
BullMQ Background Workers (AI & Transcription)
```

**Realtime:** P2P WebRTC signaling is routed through the Socket.IO server, abstracted to support future upgrades to an SFU like LiveKit.

## Project Structure

```
VOOM/
├── ZBACKEND/
│   ├── src/
│   │   ├── config/          # Configurations & env loaders
│   │   ├── controllers/     # API route handlers
│   │   ├── middleware/      # Auth, tenant, security middlewares
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Business logic & AI provider integrations
│   │   ├── sockets/         # Socket.IO handlers
│   │   ├── workers/         # BullMQ queue processors
│   │   ├── utils/           # Utilities & helpers
│   │   ├── app.js           # Express app setup
│   │   ├── server.js        # Web Server entry point
│   │   └── worker.js        # Background worker entry point
│   ├── package.json
│   └── .env.example
│
├── zfrontend/
│   ├── public/
│   ├── src/
│   │   ├── components/      # Reusable UI elements
│   │   ├── contexts/        # Global application state (Auth, Org)
│   │   ├── pages/           # Page-level screens
│   │   ├── realtime/        # WebRTC / LiveKit abstraction logic
│   │   ├── services/        # API communication & Axios clients
│   │   ├── styles/          # Global styles
│   │   └── App.js
│   ├── package.json
│   └── .env.example
│
├── tests/                   # End-to-end integration and load tests
│   ├── run_all.mjs
│   ├── test_phase*.mjs
│   └── ...
│
├── README.md
└── .gitignore
```

## Tech Stack

- **Frontend:** React, React Router, Material UI, Axios, Socket.IO Client, WebRTC
- **Backend:** Node.js, Express, Socket.IO, JWT, BullMQ, Redis
- **Database:** MongoDB Atlas, Mongoose, Vector Search
- **AI & Integrations:** OpenAI, AssemblyAI, Deepgram (Abstracted)

## Local Setup

### 1. Database & Cache
- Requires **MongoDB** (Local or Atlas)
- Requires **Redis** (Minimum v6.2 recommended)

### 2. Backend API
```bash
cd ZBACKEND
npm install
npm run dev
```

### 3. Background Workers
To process AI and transcription tasks, run the worker in a separate terminal:
```bash
cd ZBACKEND
node src/worker.js
```

### 4. Frontend
```bash
cd zfrontend
npm install
npm start
```

## Environment Variables
*(Do not commit actual secrets! Use the provided `.env.example` templates)*

**Backend:**
```env
PORT=8000
NODE_ENV=development
MONGO_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
REDIS_URL=
OPENAI_API_KEY=
ASSEMBLYAI_API_KEY=
STRIPE_WEBHOOK_SECRET=
```

**Frontend:**
```env
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_SOCKET_URL=http://localhost:8000
```

## Testing

Voom features a comprehensive suite of integration and load tests.
To run the full regression suite:
```bash
cd tests
node run_all.mjs
```

## Deployment Architecture

The verified deployment architecture isolates components for maximum stability:

- **Frontend:** Render Static Site (VERIFIED)
- **Backend API:** Render Web Service (VERIFIED)
- **Background Worker:** Render Background Worker Service (VERIFIED)
- **Database:** MongoDB Atlas (VERIFIED)
- **Cache/Queue:** Production Redis Cluster (VERIFIED)

## Project Status

- Phase 1-14: Completed
- Phase 15: Load Testing & Reliability (Passed successfully at high concurrency)
- Phase 15.5: Final Product Audit & GitHub Release (Completed)
- **Final Status: READY FOR DEPLOYMENT**
