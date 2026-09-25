import mongoose, { Schema } from "mongoose";

const membershipSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        organization: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true
        },
        role: {
            type: String,
            enum: ["owner", "admin", "member"],
            default: "member",
            required: true
        },
        status: {
            type: String,
            enum: ["active", "invited", "suspended"],
            default: "active",
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

// Compound index: unique constraint to prevent duplicate memberships
membershipSchema.index({ organization: 1, user: 1 }, { unique: true });

// Compound index: efficient lookup of user's active organizations
membershipSchema.index({ user: 1, organization: 1 });

const Membership = mongoose.model("Membership", membershipSchema);

export { Membership };
