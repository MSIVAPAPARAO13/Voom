import mongoose, { Schema } from "mongoose";

/**
 * Transcript Model
 *
 * Persists normalized meeting transcripts associated with:
 * Organization -> Meeting -> Recording.
 *
 * Enforces strict tenant and cross-meeting isolation through compound unique indexing.
 * Contains timestamped segments for click-to-seek video playback and case-insensitive search.
 */
const transcriptSegmentSchema = new Schema(
    {
        start: {
            type: Number,
            required: true
        },
        end: {
            type: Number,
            required: true
        },
        text: {
            type: String,
            required: true,
            trim: true
        },
        speaker: {
            type: String,
            default: null
        }
    },
    { _id: false }
);

const transcriptSchema = new Schema(
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
        meetingCode: {
            type: String,
            required: true,
            index: true
        },
        recordingId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true
        },
        provider: {
            type: String,
            enum: ["assemblyai", "deepgram", "openai", "mock-whisper"],
            default: "assemblyai"
        },
        status: {
            type: String,
            enum: ["queued", "processing", "completed", "failed"],
            default: "queued",
            index: true
        },
        language: {
            type: String,
            default: "en"
        },
        duration: {
            type: Number,
            default: 0
        },
        segments: [transcriptSegmentSchema],
        rawText: {
            type: String,
            default: ""
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

// Enforce single authoritative transcript per recording within an organization and meeting
transcriptSchema.index({ organization: 1, meeting: 1, recordingId: 1 }, { unique: true });

const Transcript = mongoose.model("Transcript", transcriptSchema);

export { Transcript };
