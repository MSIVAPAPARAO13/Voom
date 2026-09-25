import os from "os";
import crypto from "crypto";

const LOG_LEVELS = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || "info"] || 20;

const sanitizeValue = (key, value) => {
    const sensitiveKeys = ["password", "token", "authorization", "cookie", "secret", "apikey", "api_key", "stripe", "livekit"];
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        return "[REDACTED]";
    }
    return value;
};

const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = typeof value === "object" ? sanitizeObject(value) : sanitizeValue(key, value);
    }
    return sanitized;
};

const formatLog = (level, message, meta = {}) => {
    const logObj = {
        timestamp: new Date().toISOString(),
        level,
        service: process.env.SERVICE_NAME || "voom-api",
        message,
        ...sanitizeObject(meta)
    };
    return JSON.stringify(logObj);
};

const logger = {
    debug: (message, meta) => {
        if (currentLevel <= LOG_LEVELS.debug) {
            console.debug(formatLog("debug", message, meta));
        }
    },
    info: (message, meta) => {
        if (currentLevel <= LOG_LEVELS.info) {
            console.info(formatLog("info", message, meta));
        }
    },
    warn: (message, meta) => {
        if (currentLevel <= LOG_LEVELS.warn) {
            console.warn(formatLog("warn", message, meta));
        }
    },
    error: (message, meta) => {
        if (currentLevel <= LOG_LEVELS.error) {
            console.error(formatLog("error", message, meta));
        }
    }
};

export default logger;
