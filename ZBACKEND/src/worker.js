import logger from "./utils/logger.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

import { fileURLToPath } from "node:url";

// Load environment variables before initializing workers
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.ENV") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { transcriptionWorker } from "./workers/transcription.worker.js";
import { intelligenceWorker } from "./workers/intelligence.worker.js";
import { knowledgeWorker } from "./workers/knowledge.worker.js";
import { closeQueues } from "./services/queue.service.js";
import { redisClient, redisSubClient, connection } from "./config/redis.js";

const startWorker = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            throw new Error("MONGODB_URI environment variable is missing.");
        }

        await mongoose.connect(MONGODB_URI);
        logger.info("Worker connected to MongoDB");
        logger.info("Worker processes started successfully. Listening for background jobs...");

        // Graceful shutdown handling
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}. Gracefully shutting down workers...`);
            
            // Stop accepting new jobs and wait for active ones to finish
            await Promise.all([
                transcriptionWorker.close(),
                intelligenceWorker.close(),
                knowledgeWorker.close(),
                closeQueues()
            ]);

            logger.info("Workers closed successfully.");
            
            // Disconnect MongoDB and Redis
            await mongoose.disconnect();
            redisClient.quit();
            redisSubClient.quit();
            connection.quit();
            
            logger.info("Disconnected from MongoDB and Redis. Exiting.");
            process.exit(0);
        };

        process.on("SIGINT", () => shutdown("SIGINT"));
        process.on("SIGTERM", () => shutdown("SIGTERM"));

    } catch (err) {
        logger.error("Failed to start worker process:", err);
        process.exit(1);
    }
};

startWorker();
