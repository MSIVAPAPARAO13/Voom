import httpStatus from "http-status";
import { entitlementService } from "../services/billing/entitlement.service.js";
import { usageService } from "../services/billing/usage.service.js";
import { billingService } from "../services/billing/billing.service.js";

/**
 * Get the current effective plan and entitlements for an organization.
 */
export const getPlan = async (req, res) => {
    try {
        const organizationId = req.organization._id;
        const plan = await entitlementService.getEffectivePlan(organizationId);
        const entitlements = await entitlementService.getOrganizationEntitlements(organizationId);
        
        return res.status(httpStatus.OK).json({
            plan,
            entitlements: entitlements.entitlements,
            limits: entitlements.limits
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Failed to fetch plan details",
            error: "Internal error"
        });
    }
};

/**
 * Get current billing period usage summary.
 */
export const getUsage = async (req, res) => {
    try {
        const organizationId = req.organization._id;
        const summary = await usageService.getUsageSummary(organizationId);
        return res.status(httpStatus.OK).json({ usage: summary });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Failed to fetch usage details",
            error: "Internal error"
        });
    }
};

/**
 * Initiate a checkout session. (Organization owner/admin only).
 */
export const createCheckout = async (req, res) => {
    try {
        const organizationId = req.organization._id;
        const { planSlug, successUrl, cancelUrl } = req.body;
        
        if (!planSlug || !successUrl || !cancelUrl) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Missing required fields" });
        }

        const session = await billingService.createCheckoutSession(organizationId, planSlug, successUrl, cancelUrl);
        return res.status(httpStatus.OK).json({ session });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Failed to initiate checkout",
            error: "Internal error"
        });
    }
};

/**
 * Webhook handler for the billing provider.
 */
export const handleWebhook = async (req, res) => {
    try {
        // Many real providers require raw body for signature verification.
        // For Phase 13 mock, we use the parsed body.
        const payload = req.body;
        const signature = req.headers["x-billing-signature"];
        
        if (!signature) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Missing signature" });
        }

        const result = await billingService.handleWebhook(payload, signature);
        return res.status(httpStatus.OK).json(result);
    } catch (error) {
        // Return 400 for signature verification failures to indicate bad request from provider
        if (error.message.includes("signature")) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Internal error" });
        }
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Webhook processing failed" });
    }
};
