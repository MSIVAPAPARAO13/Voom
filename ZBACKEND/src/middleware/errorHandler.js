import httpStatus from "http-status";

/**
 * Centralized error-handling middleware.
 * Formats errors consistently and ensures no internal stack traces leak to clients.
 */
export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    const message = err.message || "Internal Server Error";

    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

    res.status(statusCode).json({
        success: false,
        message: message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
};
