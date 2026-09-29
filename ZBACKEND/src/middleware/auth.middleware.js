import jwt from "jsonwebtoken";
import httpStatus from "http-status";

/**
 * Authentication Middleware:
 * Verifies short-lived JWT access token in the Authorization header.
 * Attaches verified user identity to req.user.
 */
export const authenticate = (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(httpStatus.UNAUTHORIZED).json({
            success: false,
            message: "Authentication required. Missing or malformed Bearer token."
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = {
            id: decoded.userId,
            username: decoded.username,
            role: decoded.role || "user"
        };
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(httpStatus.UNAUTHORIZED).json({
                success: false,
                code: "TOKEN_EXPIRED",
                message: "Access token expired. Please refresh your session."
            });
        }
        return res.status(httpStatus.UNAUTHORIZED).json({
            success: false,
            message: "Invalid access token."
        });
    }
};

/**
 * Optional Authentication Middleware:
 * If Authorization header with Bearer token is provided, verifies it and attaches req.user.
 * If absent, proceeds without error (req.user remains undefined).
 */
export const optionalAuthenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = {
            id: decoded.userId,
            username: decoded.username,
            role: decoded.role || "user"
        };
    } catch (error) {
        // Silently continue without authenticated user on invalid/expired token
    }
    next();
};


/**
 * Role-Based Authorization Middleware:
 * Verifies that the authenticated user possesses the required role.
 */
export const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(httpStatus.FORBIDDEN).json({
                success: false,
                message: `Access denied. Requires '${role}' role.`
            });
        }
        next();
    };
};
