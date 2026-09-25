import httpStatus from "http-status";
import logger from "../utils/logger.js";

/**
 * Centralized error-handling middleware.
 * Formats errors consistently and ensures no internal stack traces leak to clients.
 */
export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    
    // Mask specific external error codes if they leak
    let message = err.message || "Internal Server Error";
    if (statusCode === 500 && process.env.NODE_ENV === "production") {
        message = "Internal Server Error";
    }

    logger.error("Unhandled API Error", {
        requestId: req.id,
        method: req.method,
        route: req.originalUrl,
        statusCode,
        errorName: err.name,
        errorMessage: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });

    res.status(statusCode).json({
        success: false,
        message: message,
        requestId: req.id,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
};
