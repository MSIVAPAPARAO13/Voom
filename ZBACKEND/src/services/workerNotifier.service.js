import logger from "../utils/logger.js";
import { redisClient } from "../config/redis.js";

/**
 * Emits events to the API process via Redis Pub/Sub.
 */
export const notifyAPI = (type, meetingCode, eventName, payload) => {
    const message = JSON.stringify({ type, meetingCode, eventName, payload });
    redisClient.publish("worker:events", message).catch((err) => {
        logger.error("Failed to publish worker event", err);
    });
};
