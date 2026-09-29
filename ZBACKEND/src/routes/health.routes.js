import { Router } from "express";
import httpStatus from "http-status";

const router = Router();

/**
 * @route   GET /api/v1/health
 * @desc    API Health Check
 * @access  Public
 */
router.get("/", (req, res) => {
    res.status(httpStatus.OK).json({
        status: "ok",
        service: process.env.SERVICE_NAME || "voom-api",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

/**
 * @route   GET /api/v1/health/ready
 * @desc    API Readiness Check
 * @access  Public
 */
router.get("/ready", async (req, res) => {
    const mongooseModule = await import("mongoose");
    const mongoose = mongooseModule.default || mongooseModule;
    const { redisClient, isRedisConfigured } = await import("../config/redis.js");
    
    const mongoStatus = mongoose.connection && mongoose.connection.readyState === 1 ? "up" : "down";
    
    let redisStatus = isRedisConfigured ? "down" : "standalone (in-memory)";
    try {
        if (redisClient && redisClient.status === "ready") {
            redisStatus = "up";
        }
    } catch (e) {
        // ignore
    }

    // Backend is fully ready to serve WebRTC, chat, and auth if MongoDB is connected
    const isReady = mongoStatus === "up";
    
    res.status(isReady ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE).json({
        status: isReady ? "ready" : "not_ready",
        dependencies: {
            mongodb: mongoStatus,
            redis: redisStatus
        }
    });
});

export default router;
