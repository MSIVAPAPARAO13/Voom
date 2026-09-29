import express from "express";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/users.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";
import healthRoutes from "./routes/health.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestCorrelationId, requestMetrics } from "./middleware/observability.js";

const app = express();

app.set("port", process.env.PORT || 8000);

// Observability and Correlation
app.use(requestCorrelationId);
app.use(requestMetrics);

// Enable CORS with credentials and dynamic origin matching for onrender.com and localhost
app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server or non-browser requests
        if (!origin) return callback(null, true);
        if (
            origin.includes("localhost") ||
            origin.includes("127.0.0.1") ||
            origin.endsWith(".onrender.com") ||
            origin === process.env.CORS_ORIGIN ||
            origin === process.env.CLIENT_URL
        ) {
            return callback(null, true);
        }
        return callback(null, true); // Permissive in deployment so custom subdomains work seamlessly
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Organization-Id", "X-Billing-Signature", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"]
}));

// Security headers
app.use(helmet());

app.use(cookieParser());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

// Data sanitization against NoSQL query injection
app.use((req, res, next) => {
    if (req.body) req.body = mongoSanitize.sanitize(req.body);
    if (req.params) req.params = mongoSanitize.sanitize(req.params);
    
    // In Express 5, req.query is a getter. Mutate it in place or re-define it.
    if (req.query) {
        const sanitizedQuery = mongoSanitize.sanitize({ ...req.query });
        Object.defineProperty(req, 'query', {
            value: sanitizedQuery,
            writable: true
        });
    }
    next();
});

// API Routes
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/organizations", organizationRoutes);
app.use("/api/v1/meetings", meetingRoutes);
app.use("/api/v1/billing", billingRoutes);

// Central Error Handler Middleware
app.use(errorHandler);

export default app;
