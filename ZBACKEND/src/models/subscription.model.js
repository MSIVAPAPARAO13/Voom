import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        unique: true // 1 active/managing subscription per org
    },
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Plan",
        required: true
    },
    status: {
        type: String,
        enum: ["trialing", "active", "past_due", "canceled", "incomplete", "paused"],
        default: "active"
    },
    provider: {
        type: String,
        required: true,
        default: "mock" // e.g. "stripe", "razorpay", "mock"
    },
    providerCustomerId: {
        type: String
    },
    providerSubscriptionId: {
        type: String
    },
    currentPeriodStart: {
        type: Date
    },
    currentPeriodEnd: {
        type: Date
    },
    cancelAtPeriodEnd: {
        type: Boolean,
        default: false
    },
    canceledAt: {
        type: Date
    }
}, { timestamps: true });

subscriptionSchema.index({ providerSubscriptionId: 1 }, { sparse: true });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
