# VOOM — Production Deployment Readiness Specification

**Document ID:** `VOOM-PROD-READINESS-2026-09-29`  
**Deployment Date:** September 29, 2026  
**Version / Tag:** `v1.0.0-prod`  
**Actual Production URLs:**  
- Frontend: `https://voom-frontend.onrender.com` (Target Blueprint URL / Pending Cloud Activation)  
- Backend API: `https://voom-api.onrender.com` (Target Blueprint URL / Pending Cloud Activation)  
**Actual Test Environments:**  
- **Staging / Local Production Simulation:** Node.js 18+, MongoDB Atlas, Redis 7.x, Headless Edge (`http://localhost:3000`, `http://localhost:8000`) — **PASSED**  
- **Real Render Cloud:** Render Static Site + Web Service + Background Worker — **BLOCKED** (Awaiting remote Git push and Render Blueprint provisioning)  
**Status:** READY FOR RENDER CLUSTER PROVISIONING (Staging: PASS / Live Cloud: PENDING ACTIVATION)  

---

## 1. Production Architecture Overview

The Voom SaaS platform is architected into three decoupled runtime services with managed persistence and message broker infrastructure:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND: Render Static Site (React 18 SPA)                             │
│ - Target URL: https://voom-frontend.onrender.com                           │
│ - Connects to API over HTTPS, connects to Socket.IO over WSS               │
│ - Pure client-side WebRTC mesh; short-lived access token stored in memory   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / WSS
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 2. BACKEND API: Render Web Service (Node.js + Express + Socket.IO)         │
│ - Port: 10000 (Render default)                                              │
│ - JWT Authentication, Multi-tenant RBAC, REST API (`/api/v1`)               │
│ - Real-time signaling & Redis Socket.IO adapter                             │
│ - Health check: GET `/api/v1/health` & Readiness: GET `/api/v1/health/ready`│
└──────────────┬──────────────────────────────────────────────┬───────────────┘
               │                                              │ BullMQ Jobs
┌──────────────▼──────────────────────────┐   ┌───────────────▼───────────────┐
│ MANAGED PERSISTENCE & BROKERS           │   │ 3. BACKGROUND WORKER          │
│ - Database: MongoDB Atlas (Mongoose)    │   │ - Render Background Worker    │
│ - Cache & PubSub: Redis 7.x (ioredis)   │   │ - BullMQ queue consumer       │
│ - Transcripts, Recordings, Vector RAG   │   │ - Transcription & AI pipelines│
└─────────────────────────────────────────┘   └───────────────────────────────┘
```

---

## 2. Required Production Services

| Service Name | Type | Platform / Host | Build / Start Command | Scale Mode |
| :--- | :--- | :--- | :--- | :--- |
| **`voom-frontend`** | Web (Static Site) | Render Static Site | `cd zfrontend && npm ci && npm run build` (Publish: `./zfrontend/build`) | CDN Distributed |
| **`voom-api`** | Web Service | Render Node.js | Build: `cd ZBACKEND && npm ci` <br> Start: `cd ZBACKEND && npm run start` | 1+ Instances (Redis Adapter) |
| **`voom-worker`** | Background Worker | Render Worker | Build: `cd ZBACKEND && npm ci` <br> Start: `cd ZBACKEND && npm run worker` | 1+ Instances (BullMQ) |
| **MongoDB Atlas** | Database | Cloud Database | M0 / M10+ Managed Cluster | High Availability Replica Set |
| **Redis** | In-Memory Broker | Redis Cloud / Upstash | Managed Port 6379 / TLS Port 6380 | Persistent AOF / Memory Store |

---

## 3. Environment Variables Classification Matrix

### A. Frontend (`zfrontend`)
| Variable | Classification | Purpose | Production Value Example |
| :--- | :--- | :--- | :--- |
| `REACT_APP_SERVER_URL` | **PRODUCTION REQUIRED** | Root URL for API & WebSockets | `https://voom-api.onrender.com` |
| `REACT_APP_SOCKET_URL` | **PRODUCTION REQUIRED** | Socket.IO signaling base URL | `https://voom-api.onrender.com` |
| `REACT_APP_REALTIME_PROVIDER` | OPTIONAL | Real-time media engine (`p2p` vs `livekit`) | `p2p` |

### B. Backend API (`ZBACKEND`)
| Variable | Classification | Purpose | Production Value Example |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **PRODUCTION REQUIRED** | Enforces production security policies | `production` |
| `PORT` | **PRODUCTION REQUIRED** | Service listen port (Render auto-injects) | `10000` |
| `MONGODB_URI` | **PRODUCTION REQUIRED (SECRET)** | Primary MongoDB Atlas connection string | `mongodb+srv://...` |
| `REDIS_URL` | **PRODUCTION REQUIRED (SECRET)** | Redis connection string for BullMQ & Sockets | `redis://...` or `rediss://...` |
| `CORS_ORIGIN` | **PRODUCTION REQUIRED** | Allowed frontend origin for CORS & cookies | `https://voom-frontend.onrender.com` |
| `JWT_ACCESS_SECRET` | **PRODUCTION REQUIRED (SECRET)** | 256-bit secret for short-lived access JWTs | `[32+ character high-entropy key]` |
| `JWT_REFRESH_SECRET` | **PRODUCTION REQUIRED (SECRET)** | 256-bit secret for HttpOnly refresh tokens | `[32+ character high-entropy key]` |
| `ACCESS_TOKEN_EXPIRES_IN` | OPTIONAL | Lifespan of memory access token | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | OPTIONAL | Lifespan of HttpOnly refresh cookie | `7d` |
| `TRANSCRIPTION_PROVIDER` | **PRODUCTION REQUIRED** | Active engine (`deepgram`, `assemblyai`, `openai`, `mock-whisper`) | `deepgram` or `mock-whisper` |
| `DEEPGRAM_API_KEY` | OPTIONAL (SECRET) | Key for Deepgram audio processing | `[Secret]` |
| `ASSEMBLYAI_API_KEY` | OPTIONAL (SECRET) | Key for AssemblyAI speech engine | `[Secret]` |
| `OPENAI_API_KEY` | OPTIONAL (SECRET) | Key for OpenAI Whisper / RAG embeddings | `[Secret]` |
| `GEMINI_API_KEY` | OPTIONAL (SECRET) | Key for Google Gemini Ask Voom synthesis | `[Secret]` |
| `STRIPE_SECRET_KEY` | OPTIONAL (SECRET) | Stripe billing secret (Test Mode `sk_test_...`) | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | OPTIONAL (SECRET) | Stripe webhook verification secret | `whsec_...` |

### C. Background Worker (`voom-worker`)
Requires the identical `NODE_ENV`, `MONGODB_URI`, `REDIS_URL`, `TRANSCRIPTION_PROVIDER`, and corresponding AI API keys as the backend API to process queued BullMQ jobs.

---

## 4. Production Secrets Security Audit

> [!IMPORTANT]
> - **Zero Client Exposure:** No JWT secrets, MongoDB credentials, Redis URLs, or provider API keys are compiled into the React client bundle.
> - **HttpOnly Cookies:** Refresh tokens are signed server-side and sent via HttpOnly, Secure, SameSite=None/Lax cookies.
> - **Bearer Interceptors:** Access tokens reside exclusively in JavaScript memory (`tokenRef`), refreshed on 401 via mutual exclusion lock.
> - **Audit Status:** CONFIGURED & VERIFIED.

---

## 5. Deployment Dependencies & Execution Sequence

1. **Step 1: Database & Redis Provisioning**
   - Ensure MongoDB Atlas network whitelist includes `0.0.0.0/0` (Render dynamically assigns outbound IPs).
   - Ensure Redis instance accepts TLS/TCP traffic and permits Pub/Sub commands.
2. **Step 2: Deploy Backend API (`voom-api`)**
   - Push repository with `render.yaml` or connect GitHub repository in Render Dashboard.
   - Configure secrets in Render Environment settings (`MONGODB_URI`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`).
   - Trigger build and await health verification at `/api/v1/health/ready`.
3. **Step 3: Deploy Background Worker (`voom-worker`)**
   - Render automatically provisions the worker via `render.yaml`.
   - Verify worker logs: `[Worker Ready] Listening to queues: transcription, intelligence, knowledge`.
4. **Step 4: Deploy Frontend Static Site (`voom-frontend`)**
   - Configure `REACT_APP_SERVER_URL` and `REACT_APP_SOCKET_URL` pointing to backend API.
   - Build compiles production assets via `npm run build`.
   - Verify static deployment at `https://voom-frontend.onrender.com`.

---

## 6. Known Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **CORS / Cookie Blocking** | Auth refresh cookie blocked cross-domain | Backend sets `SameSite: 'none', secure: true` in production; `credentials: true` on Axios client. |
| **Redis Out-of-Memory** | Worker stalls, BullMQ jobs hang | Configure Redis maxmemory policy to `noeviction` for BullMQ queues; enable AOF persistence. |
| **Cold Starts on Free Tier** | Initial API request latency (50s) | Recommended Starter/Standard plan on Render; health check probe prevents container cycling. |
| **WebRTC Symmetric NAT** | Direct P2P connection fails between certain firewalls | STUN servers configured (`stun.l.google.com:19302`); optional LiveKit SFU fallback supported. |

---

## 7. Pre-Deployment Verification Checklist

- [x] Backend syntax & unit tests pass.
- [x] Health check endpoint `/api/v1/health` responds 200 OK.
- [x] Readiness check `/api/v1/health/ready` confirms MongoDB and Redis status "up".
- [x] Zero unused imports and clean React build.
- [x] Sockets configured with Redis adapter for horizontal scalability.
- [x] Rate limiting active on auth endpoints (`authLimiter`).
- [x] No plaintext passwords or credentials committed to Git.
