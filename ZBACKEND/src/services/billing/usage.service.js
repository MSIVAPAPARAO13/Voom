import { Usage } from "../../models/usage.model.js";

class UsageService {
    /**
     * Determines the current billing period start and end (monthly).
     * In a real implementation, this should probably read from the Subscription's currentPeriodStart/End.
     */
    getCurrentPeriod() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start, end };
    }

    /**
     * Atomically increments usage for a specific metric.
     * Upserts the usage record if it doesn't exist for the period.
     */
    async incrementUsage(organizationId, metric, quantity = 1) {
        const { start, end } = this.getCurrentPeriod();
        
        const usage = await Usage.findOneAndUpdate(
            {
                organization: organizationId,
                metric,
                periodStart: start,
                periodEnd: end
            },
            {
                $inc: { quantity: quantity }
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            }
        );

        return usage;
    }

    /**
     * Retrieves the current usage quantity for a metric.
     */
    async getUsage(organizationId, metric) {
        const { start, end } = this.getCurrentPeriod();
        const usage = await Usage.findOne({
            organization: organizationId,
            metric,
            periodStart: start,
            periodEnd: end
        });
        return usage ? usage.quantity : 0;
    }

    /**
     * Retrieves all usage records for the current period.
     */
    async getUsageSummary(organizationId) {
        const { start, end } = this.getCurrentPeriod();
        const usages = await Usage.find({
            organization: organizationId,
            periodStart: start,
            periodEnd: end
        });

        const summary = {};
        for (const usage of usages) {
            summary[usage.metric] = usage.quantity;
        }
        return summary;
    }

    /**
     * Checks if the usage limit will be exceeded by adding requestedQuantity.
     */
    async checkUsageLimit(organizationId, metric, limit, requestedQuantity = 1) {
        const currentUsage = await this.getUsage(organizationId, metric);
        return (currentUsage + requestedQuantity) > limit;
    }
}

export const usageService = new UsageService();
