import crypto from "crypto";
import logger from "../utils/logger.js";

/**
 * Middleware to assign a unique request ID to each incoming request
 */
export const requestCorrelationId = (req, res, next) => {
    // Use provided safe ID or generate a new one
    let requestId = req.headers["x-request-id"];
    
    // Validate uuid if provided, else generate
    if (!requestId || typeof requestId !== "string" || requestId.length > 50) {
        requestId = crypto.randomUUID();
    }
    
    req.id = requestId;
    res.setHeader("X-Request-Id", requestId);
    
    next();
};

/**
 * Middleware to log request start and track HTTP metrics
 */
export const requestMetrics = (req, res, next) => {
    const start = process.hrtime.bigint();

    // Log incoming request
    logger.info("Incoming request", {
        requestId: req.id,
        method: req.method,
        route: req.originalUrl,
        ip: req.ip
    });

    res.on("finish", () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1000000.0;
        
        const meta = {
            requestId: req.id,
            method: req.method,
            route: req.route ? req.baseUrl + req.route.path : req.originalUrl, // Normalize route
            statusCode: res.statusCode,
            durationMs: parseFloat(durationMs.toFixed(2))
        };

        if (res.statusCode >= 400) {
            logger.warn("Request completed with error", meta);
        } else {
            logger.info("Request completed", meta);
        }
    });

    next();
};
