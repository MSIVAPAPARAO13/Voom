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
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

export default router;
