import { Router } from "express";
import {
    register,
    login,
    refreshToken,
    logout,
    getMe,
    getUserHistory,
    addToHistory
} from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { resolveTenant } from "../middleware/tenant.middleware.js";

const router = Router();

// Public & Rate-Limited Auth Endpoints
router.route("/register").post(authLimiter, register);
router.route("/login").post(authLimiter, login);
router.route("/refresh").post(authLimiter, refreshToken);

// Logout (can be called even if access token is expired; reads refresh cookie)
router.route("/logout").post(logout);

// Protected User Endpoints (Require Bearer Access Token & Canonical Tenant Resolution)
router.route("/me").get(authenticate, getMe);
router.route("/add_to_activity").post(authenticate, resolveTenant, addToHistory);
router.route("/get_all_activity").get(authenticate, resolveTenant, getUserHistory);

export default router;