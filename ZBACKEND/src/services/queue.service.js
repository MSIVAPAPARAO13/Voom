import { Queue } from "bullmq";
import { connection } from "../config/redis.js";

// Queues with default job options
export const transcriptionQueue = new Queue("transcription", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: 100 // Keep last 100 failed jobs for debugging
    }
});

export const intelligenceQueue = new Queue("intelligence", {
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

export const knowledgeQueue = new Queue("knowledge", {
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

// Helper for closing queues gracefully
export const closeQueues = async () => {
    await transcriptionQueue.close();
    await intelligenceQueue.close();
    await knowledgeQueue.close();
};
