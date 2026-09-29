import mongoose from "mongoose";

const usageSchema = new mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true
    },
    metric: {
        type: String,
        required: true
    },
    periodStart: {
        type: Date,
        required: true
    },
    periodEnd: {
        type: Date,
        required: true
    },
    quantity: {
        type: Number,
        default: 0
    },
    metadata: {
        type: Map,
        of: String,
        default: {}
    }
}, { timestamps: true });

// Compound index for efficient querying and atomic updates
usageSchema.index({ organization: 1, metric: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

export const Usage = mongoose.model("Usage", usageSchema);
