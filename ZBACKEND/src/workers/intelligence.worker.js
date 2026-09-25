import { Worker } from "bullmq";
import { connection } from "../config/redis.js";
import { Meeting } from "../models/meeting.model.js";
import { Transcript } from "../models/transcript.model.js";
import { MeetingIntelligence } from "../models/meetingIntelligence.model.js";
import { meetingAIService } from "../services/meetingAI.service.js";
import { notifyAPI } from "../services/workerNotifier.service.js";
import { knowledgeQueue } from "../services/queue.service.js";
import { usageService } from "../services/billing/usage.service.js";

export const intelligenceWorker = new Worker("intelligence", async (job) => {
    const { intelligenceId, transcriptId, meetingCode, recordingId, organizationId } = job.data;

    if (!intelligenceId || !transcriptId || !meetingCode || !recordingId || !organizationId) {
        throw new Error("Missing required parameters in intelligence job");
    }

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting || meeting.organization.toString() !== organizationId) {
        throw new Error("Tenant isolation violation or missing meeting");
    }

    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
        throw new Error(`Transcript not found: ${transcriptId}`);
    }

    const intelligence = await MeetingIntelligence.findById(intelligenceId);
    if (!intelligence) {
        throw new Error(`Intelligence not found: ${intelligenceId}`);
    }

    intelligence.status = "processing";
    await intelligence.save();

    notifyAPI("ai", meetingCode, "meeting:ai-processing", {
        meetingCode,
        recordingId,
        status: "processing"
    });

    try {
        const result = await meetingAIService.generateMeetingIntelligence(transcript);

        intelligence.status = "completed";
        intelligence.summary = result.summary;
        intelligence.keyPoints = result.keyPoints;
        intelligence.decisions = result.decisions;
        intelligence.actionItems = result.actionItems;
        intelligence.topics = result.topics;
        intelligence.completedAt = new Date();
        intelligence.error = null;
        await intelligence.save();

        await usageService.incrementUsage(organizationId, "ai_processing", 1);

        notifyAPI("ai", meetingCode, "meeting:ai-completed", {
            meetingCode,
            recordingId,
            status: "completed",
            hasSummary: true
        });

        // Trigger Knowledge indexing again to include the AI output
        await knowledgeQueue.add("index_transcript", {
            transcriptId: transcript._id.toString(),
            meetingCode,
            organizationId
        });

        return { success: true, intelligenceId: intelligence._id };
    } catch (err) {
        console.error(`AI generation error for recording ${recordingId}:`, err.message);
        intelligence.status = "failed";
        intelligence.error = err.message || "AI generation failed";
        await intelligence.save().catch(() => {});

        notifyAPI("ai", meetingCode, "meeting:ai-failed", {
            meetingCode,
            recordingId,
            status: "failed",
            error: "AI generation failed. Please try again."
        });

        throw err;
    }
}, { connection });

intelligenceWorker.on("failed", (job, err) => {
    console.error(`Intelligence Job ${job.id} failed: ${err.message}`);
});
