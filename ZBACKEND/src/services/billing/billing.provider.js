/**
 * Base abstract class for Billing Providers (e.g., Stripe, Razorpay)
 */
export class BillingProvider {
    /**
     * Creates a customer in the provider's system.
     */
    async createCustomer(organizationId, email, name) {
        throw new Error("Not implemented");
    }

    /**
     * Creates a checkout session for subscribing to a plan.
     */
    async createCheckoutSession(organizationId, planSlug, successUrl, cancelUrl) {
        throw new Error("Not implemented");
    }

    /**
     * Cancels an active subscription at period end.
     */
    async cancelSubscription(providerSubscriptionId) {
        throw new Error("Not implemented");
    }

    /**
     * Retrieves subscription details.
     */
    async getSubscription(providerSubscriptionId) {
        throw new Error("Not implemented");
    }

    /**
     * Handles provider webhooks (signature verification and event normalization).
     */
    async handleWebhook(payload, signature, secret) {
        throw new Error("Not implemented");
    }
}
