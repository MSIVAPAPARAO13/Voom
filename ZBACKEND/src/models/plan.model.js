import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    description: String,
    active: {
        type: Boolean,
        default: true
    },
    price: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: "USD"
    },
    billingInterval: {
        type: String,
        enum: ["month", "year"],
        default: "month"
    },
    entitlements: {
        type: Map,
        of: Boolean,
        default: {}
    },
    limits: {
        type: Map,
        of: Number,
        default: {}
    },
    metadata: {
        type: Map,
        of: String,
        default: {}
    }
}, { timestamps: true });

export const Plan = mongoose.model("Plan", planSchema);
