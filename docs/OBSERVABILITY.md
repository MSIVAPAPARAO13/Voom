# Voom Observability Guide (Phase 16)

Voom is instrumented with a lightweight, production-grade observability suite designed to answer critical operational questions without exposing sensitive data.

## 1. Structured Logging

A centralized JSON logger (`src/utils/logger.js`) is used across the API and background workers.
All logs are emitted to standard output/error, which can be ingested by any standard log aggregation system (e.g., Datadog, AWS CloudWatch, ELK).

Log Levels:
- `debug`: Detailed diagnostics (not recommended for production)
- `info`: Application events (startup, incoming requests, job completion)
- `warn`: Recoverable errors, 4xx HTTP responses
- `error`: Unhandled exceptions, 5xx HTTP responses, worker crashes

## 2. Request Correlation

Every incoming HTTP request is assigned a unique `X-Request-Id` UUID, generated automatically or propagated safely from edge proxies.
This ID is attached to:
- Incoming/completed HTTP request logs
- API error logs
- Frontend responses (exposed in CORS headers for tracing)

## 3. Health & Readiness

Voom exposes two essential operational endpoints:

**Liveness (Health)**
- `GET /api/v1/health`
- Confirms the Node.js API process is responsive.

**Readiness**
- `GET /api/v1/health/ready`
- Actively verifies connections to MongoDB and Redis.
- Use this endpoint for Kubernetes or load-balancer readiness probes to ensure the container receives traffic only when dependencies are healthy.

## 4. Real-time Socket.IO Observability

Socket connections and disconnects are instrumented.
- `logger.info("Socket connected", { socketId: socket.id })`
- `logger.info("Socket disconnected", { socketId: socket.id })`
- Security events such as failed authentications are tracked as warnings.
SDP payloads, ICE candidates, and chat contents are explicitly NOT logged to maintain data privacy.

## 5. Background Jobs (BullMQ)

The worker process (`src/worker.js`) utilizes the centralized logger to trace task execution.
- Startup/Shutdown states
- Connections to dependencies
- Job successes and failures are securely recorded.

## 6. Frontend Global Error Visibility

The React application uses a lightweight global listener on the `window` object to intercept:
- Uncaught JavaScript errors
- Unhandled promise rejections
- Axios API failures
These are securely reported to the browser console (`console.error`), allowing standard telemetry systems to collect them safely without leaking authentication tokens or transcript payloads.

## 7. Sensitive Data Redaction

Voom's logging strategy prioritizes security and tenant isolation:
- No passwords, JWTs, or access tokens are ever logged.
- The `logger.js` automatically sanitizes objects containing keys like `password`, `token`, `authorization`.
- No raw WebRTC chat data or AI transcripts are logged.

## Configuration

Control the visibility level using environment variables:
```env
LOG_LEVEL=info
SERVICE_NAME=voom-api
```
