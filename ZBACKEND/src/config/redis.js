import logger from "../utils/logger.js";
import Redis from "ioredis";

// Shared Redis configuration across the application
const getRedisUrl = () => process.env.REDIS_URL || "redis://127.0.0.1:6379";

// A single shared instance for general usage (e.g. Socket.IO adapter)
export const redisClient = new Redis(getRedisUrl(), { maxRetriesPerRequest: null });

// Sub client for adapter
export const redisSubClient = redisClient.duplicate();

// Connection options for BullMQ (BullMQ requires maxRetriesPerRequest: null)
export const connection = new Redis(getRedisUrl(), { maxRetriesPerRequest: null });

redisClient.on("error", (err) => logger.error("Redis Client Error", err));
redisSubClient.on("error", (err) => logger.error("Redis SubClient Error", err));
connection.on("error", (err) => logger.error("Redis BullMQ Connection Error", err));
