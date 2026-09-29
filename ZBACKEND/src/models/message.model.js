import mongoose, { Schema } from "mongoose";

/**
 * Message Schema for Persistent Meeting Chat
 *
 * ARCHITECTURAL RATIONALE:
 * Unlike workspace items (which are finite and scoped per meeting), meeting chat
 * messages are high-frequency and unbounded. Embedding them in Meeting would risk
 * exceeding MongoDB's 16MB BSON document limit and degrade pagination performance.
 * A dedicated collection allows compound indexing ({ meetingCode: 1, createdAt: -1 }),
 * efficient cursor/limit pagination, and atomic message updates/reactions.
 */
const messageSchema = new Schema(
    {
        meeting: {
            type: Schema.Types.ObjectId,
            ref: "Meeting",
            required: true,
            index: true
        },
        meetingCode: {
            type: String,
            required: true,
            index: true
        },
        organization: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            index: true
        },
        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            index: true
        },
        senderName: {
            type: String,
            required: true,
            trim: true,
            maxLength: 100
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxLength: 2000
        },
        isEdited: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        reactions: [
            {
                emoji: {
                    type: String,
                    required: true,
                    trim: true,
                    maxLength: 10
                },
                user: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    required: true
                },
                username: {
                    type: String,
                    required: true
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },
    { timestamps: true }
);

// Compound indexes for high-performance paginated lookups and tenant queries
messageSchema.index({ meetingCode: 1, createdAt: -1 });
messageSchema.index({ organization: 1, meetingCode: 1 });

const Message = mongoose.model("Message", messageSchema);

export { Message };
