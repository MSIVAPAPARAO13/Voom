import mongoose, { Schema } from "mongoose";

/**
 * Knowledge Chunk Model
 *
 * Stores vectorized segments of meeting transcripts and AI intelligence for
 * RAG-based organizational memory (Ask Voom).
 *
 * Enforces strict tenant isolation.
 */
const knowledgeChunkSchema = new Schema(
    {
        organization: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true
        },
        meeting: {
            type: Schema.Types.ObjectId,
            ref: "Meeting",
            required: true,
            index: true
        },
        recordingId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true
        },
        transcriptId: {
            type: Schema.Types.ObjectId,
            ref: "Transcript",
            required: true,
            index: true
        },
        sourceType: {
            type: String,
            enum: ["transcript_segment", "meeting_summary", "meeting_decision", "meeting_action_item", "meeting_key_point"],
            required: true
        },
        sourceId: {
            type: String,
            required: true // A deterministic ID to prevent duplicates (e.g., segment index or AI block ID)
        },
        text: {
            type: String,
            required: true
        },
        startTime: {
            type: Number,
            default: null
        },
        endTime: {
            type: Number,
            default: null
        },
        embedding: {
            type: [Number], // Array of floats
            required: true
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {}
        }
    },
    { timestamps: true }
);

// Enforce idempotency: prevent duplicate chunks for the same source within a transcript
knowledgeChunkSchema.index(
    { organization: 1, transcriptId: 1, sourceType: 1, sourceId: 1 },
    { unique: true }
);

export const KnowledgeChunk = mongoose.model("KnowledgeChunk", knowledgeChunkSchema);
