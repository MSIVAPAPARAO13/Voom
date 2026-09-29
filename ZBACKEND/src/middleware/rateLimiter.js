import rateLimit from "express-rate-limit";

/**
 * Targeted rate limiter for sensitive authentication endpoints:
 * - Login
 * - Registration
 * - Token Refresh
 *
 * Limits each IP to 30 requests per 15-minute window.
 * Does NOT affect WebRTC signaling, Socket.IO, or normal meeting operations.
 * Designed to be easily swapped with Redis store in future scaling phases.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.AUTH_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) : (process.env.NODE_ENV === "production" ? 30 : 500), // Configurable, higher limit for local dev/testing
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    message: {
        success: false,
        message: "Too many authentication attempts from this IP. Please try again after 15 minutes."
    }
});
