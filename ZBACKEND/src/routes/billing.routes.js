import express from "express";
import { getPlan, getUsage, createCheckout, handleWebhook } from "../controllers/billing.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { resolveTenant, requireOrgRole } from "../middleware/tenant.middleware.js";

const router = express.Router();

// Webhooks don't use standard user/tenant auth
router.post("/webhook", handleWebhook);

// All other routes require auth and tenant resolution
router.use(authenticate);
router.use(resolveTenant);

router.get("/plan", requireOrgRole(["owner", "admin", "member"]), getPlan);
router.get("/usage", requireOrgRole(["owner", "admin"]), getUsage);
router.post("/checkout", requireOrgRole(["owner", "admin"]), createCheckout);

export default router;
