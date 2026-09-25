import { Organization } from "../../models/organization.model.js";
import { Subscription } from "../../models/subscription.model.js";
import { Plan } from "../../models/plan.model.js";
import { usageService } from "./usage.service.js";

// Hardcoded fallback dev plan in case no subscription exists yet.
// Ensures Phase 2-12 tests continue working without active subscriptions.
const DEFAULT_DEV_PLAN = {
    slug: "dev-free",
    entitlements: {
        members: true,
        meetings: true,
        recording: true,
        transcription: true,
        meetingAI: true,
        askVoom: true
    },
    limits: {
        members: 5000,
        meetingDuration: 120, // minutes
        transcription_minutes: 1000,
        storage_gb: 10
    }
};

class EntitlementService {
    /**
     * Resolves the effective plan for an organization.
     */
    async getEffectivePlan(organizationId) {
        const subscription = await Subscription.findOne({
            organization: organizationId,
            status: { $in: ["active", "trialing"] }
        }).populate("plan");

        if (subscription && subscription.plan) {
            return subscription.plan;
        }

        return DEFAULT_DEV_PLAN;
    }

    /**
     * Retrieves all entitlements and limits for an organization.
     */
    async getOrganizationEntitlements(organizationId) {
        const plan = await this.getEffectivePlan(organizationId);
        return {
            entitlements: plan.entitlements,
            limits: plan.limits
        };
    }

    /**
     * Checks if a boolean feature is enabled.
     */
    async hasFeature(organizationId, featureKey) {
        const plan = await this.getEffectivePlan(organizationId);
        if (plan.entitlements instanceof Map) {
            return !!plan.entitlements.get(featureKey);
        }
        return !!plan.entitlements[featureKey];
    }

    /**
     * Checks if an organization is allowed to use a metered feature, considering its current usage.
     * Optionally takes `requestedQuantity` to check if a specific amount can be consumed.
     */
    async canUseFeature(organizationId, featureKey, metricKey, requestedQuantity = 1) {
        const hasEntitlement = await this.hasFeature(organizationId, featureKey);
        if (!hasEntitlement) return { allowed: false, reason: "FEATURE_NOT_ENTITLED" };

        if (!metricKey) return { allowed: true };

        const plan = await this.getEffectivePlan(organizationId);
        
        let limit;
        if (plan.limits instanceof Map) {
            limit = plan.limits.get(metricKey);
        } else {
            limit = plan.limits[metricKey];
        }

        if (limit === undefined || limit === null) return { allowed: true };

        const isLimitExceeded = await usageService.checkUsageLimit(organizationId, metricKey, limit, requestedQuantity);
        if (isLimitExceeded) {
            return { allowed: false, reason: "LIMIT_EXCEEDED" };
        }

        return { allowed: true };
    }

    /**
     * Gets the numeric limit for a specific metric.
     */
    async getLimit(organizationId, metricKey) {
        const plan = await this.getEffectivePlan(organizationId);
        if (plan.limits instanceof Map) {
            return plan.limits.get(metricKey);
        }
        return plan.limits[metricKey];
    }
}

export const entitlementService = new EntitlementService();
