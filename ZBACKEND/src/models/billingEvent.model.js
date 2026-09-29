import mongoose from "mongoose";

const billingEventSchema = new mongoose.Schema({
    provider: {
        type: String,
        required: true
    },
    providerEventId: {
        type: String,
        required: true
    },
    eventType: {
        type: String,
        required: true
    },
    processed: {
        type: Boolean,
        default: false
    },
    processedAt: {
        type: Date
    },
    payload: {
        type: mongoose.Schema.Types.Mixed
    },
    error: String
}, { timestamps: true });

// Ensures webhook idempotency
billingEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });

export const BillingEvent = mongoose.model("BillingEvent", billingEventSchema);
