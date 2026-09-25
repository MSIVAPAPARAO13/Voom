import { MockBillingProvider } from "./mock.provider.js";
import { Subscription } from "../../models/subscription.model.js";
import { Plan } from "../../models/plan.model.js";
import { BillingEvent } from "../../models/billingEvent.model.js";
import mongoose from "mongoose";

class BillingService {
    constructor() {
        // Factory logic could go here based on ENV.
        // For Phase 13, default to MockBillingProvider.
        const providerName = process.env.BILLING_PROVIDER || "mock";
        this.providerName = providerName;
        
        if (providerName === "mock") {
            this.provider = new MockBillingProvider();
        } else {
            // Throw if unknown to enforce clean provider resolution
            throw new Error(`Unsupported billing provider: ${providerName}`);
        }
    }

    async createCheckoutSession(organizationId, planSlug, successUrl, cancelUrl) {
        return this.provider.createCheckoutSession(organizationId, planSlug, successUrl, cancelUrl);
    }

    /**
     * Webhook entry point. Validates signature and ensures idempotency.
     */
    async handleWebhook(payload, signature) {
        const secret = process.env.BILLING_WEBHOOK_SECRET || "mock_secret";
        
        // 1. Signature verification and normalization
        const normalizedEvent = await this.provider.handleWebhook(payload, signature, secret);

        // 2. Idempotency check via unique index insertion
        const eventId = normalizedEvent.providerEventId;
        
        try {
            const billingEvent = new BillingEvent({
                provider: this.providerName,
                providerEventId: eventId,
                eventType: normalizedEvent.eventType,
                payload: normalizedEvent.data
            });
            await billingEvent.save();

            // 3. Process event
            await this.processNormalizedEvent(normalizedEvent.eventType, normalizedEvent.data);

            // 4. Mark processed
            billingEvent.processed = true;
            billingEvent.processedAt = new Date();
            await billingEvent.save();

            return { received: true, processed: true };
        } catch (error) {
            // Duplicate key error (E11000) means we already saw this event
            if (error.code === 11000) {
                console.log(`Webhook idempotency skipped duplicate event: ${eventId}`);
                return { received: true, processed: false, reason: "duplicate" };
            }
            throw error;
        }
    }

    async processNormalizedEvent(eventType, data) {
        // In a real provider, this would map generic events to domain updates.
        // For this mock phase, we support a mock 'checkout.completed'
        if (eventType === "checkout.completed") {
            const { organizationId, planSlug, subscriptionId } = data;
            
            const plan = await Plan.findOne({ slug: planSlug });
            if (!plan) throw new Error(`Plan not found: ${planSlug}`);

            // Upsert subscription
            await Subscription.findOneAndUpdate(
                { organization: organizationId },
                {
                    plan: plan._id,
                    status: "active",
                    provider: this.providerName,
                    providerSubscriptionId: subscriptionId,
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                },
                { upsert: true, new: true }
            );
        } else if (eventType === "subscription.canceled") {
            const { subscriptionId } = data;
            await Subscription.findOneAndUpdate(
                { providerSubscriptionId: subscriptionId, provider: this.providerName },
                { status: "canceled", canceledAt: new Date(), cancelAtPeriodEnd: true }
            );
        }
    }
}

export const billingService = new BillingService();
