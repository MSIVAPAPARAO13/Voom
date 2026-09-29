import mongoose, { Schema } from "mongoose";

/**
 * Meeting Intelligence Model
 *
 * Persists structured AI meeting intelligence (Summary, Key Points, Decisions, Action Items, Topics)
 * derived from a completed transcript.
 *
 * Enforces strict tenant and cross-meeting isolation through compound unique indexing.
 * Ensures only ONE authoritative intelligence record exists per transcript.
 */
const decisionSchema = new Schema(
    {
        text: { type: String, required: true },
        timestamp: { type: Number, default: null }
    },
    { _id: false }
);

const actionItemSchema = new Schema(
    {
        task: { type: String, required: true },
        assignee: { type: String, default: null },
        dueDate: { type: String, default: null },
        timestamp: { type: Number, default: null }
    },
    { _id: false }
);

const meetingIntelligenceSchema = new Schema(
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
        provider: {
            type: String,
            default: "openai"
        },
        model: {
            type: String,
            default: "gpt-4o-mini"
        },
        status: {
            type: String,
            enum: ["queued", "processing", "completed", "failed"],
            default: "queued",
            index: true
        },
        summary: {
            type: String,
            default: ""
        },
        keyPoints: {
            type: [String],
            default: []
        },
        decisions: {
            type: [decisionSchema],
            default: []
        },
        actionItems: {
            type: [actionItemSchema],
            default: []
        },
        topics: {
            type: [String],
            default: []
        },
        startedAt: {
            type: Date,
            default: Date.now
        },
        completedAt: {
            type: Date,
            default: null
        },
        error: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

// Enforce single authoritative AI intelligence record per transcript within an organization and meeting
meetingIntelligenceSchema.index(
    { organization: 1, meeting: 1, recordingId: 1, transcriptId: 1 },
    { unique: true }
);

export const MeetingIntelligence = mongoose.models.MeetingIntelligence || mongoose.model("MeetingIntelligence", meetingIntelligenceSchema);
