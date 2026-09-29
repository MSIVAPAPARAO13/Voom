import { Queue } from "bullmq";
import { connection, isRedisConfigured } from "../config/redis.js";
import logger from "../utils/logger.js";

const createSafeQueue = (name) => {
    if (isRedisConfigured && connection) {
        try {
            return new Queue(name, {
                connection,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: "exponential",
                        delay: 5000
                    },
                    removeOnComplete: true,
                    removeOnFail: 100
                }
            });
        } catch (err) {
            logger.warn(`[Queue] Failed to initialize ${name} queue:`, err.message);
        }
    }

    // Safe in-memory fallback if Redis is not configured
    return {
        add: async (jobName, data) => {
            logger.info(`[Queue:Mock] Job '${jobName}' queued in memory for queue '${name}'`);
            return { id: `mock-${Date.now()}`, name: jobName, data };
        },
        close: async () => {}
    };
};

// Queues with default job options or fallback
export const transcriptionQueue = createSafeQueue("transcription");
export const intelligenceQueue = createSafeQueue("intelligence");
export const knowledgeQueue = createSafeQueue("knowledge");

// Helper for closing queues gracefully
export const closeQueues = async () => {
    if (transcriptionQueue && transcriptionQueue.close) await transcriptionQueue.close();
    if (intelligenceQueue && intelligenceQueue.close) await intelligenceQueue.close();
    if (knowledgeQueue && knowledgeQueue.close) await knowledgeQueue.close();
};

