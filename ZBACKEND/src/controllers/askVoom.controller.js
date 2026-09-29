import logger from "../utils/logger.js";
import httpStatus from "http-status";
import { askVoom } from "../services/askVoom.service.js";
import { entitlementService } from "../services/billing/entitlement.service.js";
import { usageService } from "../services/billing/usage.service.js";

/**
 * Handle Ask Voom queries.
 * Route: POST /api/v1/organizations/:id/ask
 * Requires: organization member
 */
export const askOrganizationKnowledge = async (req, res) => {
    try {
        const organizationId = req.params.id;
        const { question, meetingId, dateFrom, dateTo } = req.body;

        if (!question || typeof question !== "string" || question.trim().length === 0) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Question is required." });
        }

        const entitlementCheck = await entitlementService.canUseFeature(organizationId, "askVoom");
        if (!entitlementCheck.allowed) {
            return res.status(httpStatus.FORBIDDEN).json({
                message: "Feature not available on the current plan",
                code: "FEATURE_NOT_ENTITLED"
            });
        }

        const result = await askVoom({
            organizationId,
            question: question.trim(),
            meetingId,
            dateFrom,
            dateTo
        });

        await usageService.incrementUsage(organizationId, "ask_voom", 1);

        return res.status(httpStatus.OK).json({
            success: true,
            answer: result.answer,
            sources: result.sources
        });
    } catch (error) {
        logger.error("Ask Voom Error:", error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: `Failed to answer question: `
        });
    }
};
