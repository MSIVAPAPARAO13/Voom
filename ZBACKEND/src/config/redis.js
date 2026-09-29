import logger from "../utils/logger.js";
import Redis from "ioredis";

// Determine if Redis is explicitly configured
const redisUrl = process.env.REDIS_URL;
const isProduction = process.env.NODE_ENV === "production";

// In production, only enable Redis if REDIS_URL is provided (prevent connecting to 127.0.0.1 on cloud hosts)
export const isRedisConfigured = Boolean(redisUrl || (!isProduction && process.env.NODE_ENV !== "test"));

const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times) {
        if (!redisUrl && isProduction) {
            return null; // Stop reconnecting to localhost in production
        }
        if (times > 3) {
            return null; // Stop reconnecting after 3 attempts
        }
        return Math.min(times * 200, 2000);
    }
};

export let redisClient = null;
export let redisSubClient = null;
export let connection = null;

if (isRedisConfigured) {
    const targetUrl = redisUrl || "redis://127.0.0.1:6379";
    try {
        redisClient = new Redis(targetUrl, redisOptions);
        redisSubClient = new Redis(targetUrl, redisOptions);
        connection = new Redis(targetUrl, redisOptions);

        redisClient.on("error", (err) => {
            if (err.code !== "ECONNREFUSED") {
                logger.error("Redis Client Error", err.message);
            }
        });
        redisSubClient.on("error", (err) => {
            if (err.code !== "ECONNREFUSED") {
                logger.error("Redis SubClient Error", err.message);
            }
        });
        connection.on("error", (err) => {
            if (err.code !== "ECONNREFUSED") {
                logger.error("Redis BullMQ Connection Error", err.message);
            }
        });

        // Trigger connection in background
        redisClient.connect().catch(() => {});
        redisSubClient.connect().catch(() => {});
        connection.connect().catch(() => {});
    } catch (err) {
        logger.warn("[Redis] Failed to initialize Redis, running in standalone mode:", err.message);
        redisClient = null;
        redisSubClient = null;
        connection = null;
    }
} else {
    logger.info("[Redis] No REDIS_URL configured in production. Running in standalone in-memory mode.");
}

