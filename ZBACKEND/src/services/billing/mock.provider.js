import { BillingProvider } from "./billing.provider.js";
import crypto from "crypto";

/**
 * Mock Billing Provider for testing and development environments.
 * Provides deterministic responses.
 */
export class MockBillingProvider extends BillingProvider {
    async createCustomer(organizationId, email, name) {
        return {
            customerId: `mock_cus_${crypto.randomBytes(8).toString("hex")}`,
            organizationId,
            email,
            name
        };
    }

    async createCheckoutSession(organizationId, planSlug, successUrl, cancelUrl) {
        return {
            sessionId: `mock_sess_${crypto.randomBytes(8).toString("hex")}`,
            url: `${successUrl}?session_id=mock_sess_success`, // Simulate immediate success
            organizationId,
            planSlug
        };
    }

    async cancelSubscription(providerSubscriptionId) {
        return {
            id: providerSubscriptionId,
            status: "canceled",
            cancelAtPeriodEnd: true
        };
    }

    async getSubscription(providerSubscriptionId) {
        return {
            id: providerSubscriptionId,
            status: "active",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };
    }

    async handleWebhook(payload, signature, secret) {
        // Deterministic mock validation
        if (signature !== "mock_valid_signature") {
            throw new Error("Invalid mock signature");
        }

        // Return normalized event
        return {
            providerEventId: payload.id || `evt_${crypto.randomBytes(8).toString("hex")}`,
            eventType: payload.type,
            data: payload.data
        };
    }
}
