import { Worker } from "bullmq";
import { connection } from "../config/redis.js";
import { Meeting } from "../models/meeting.model.js";
import { Transcript } from "../models/transcript.model.js";
import { transcriptionService } from "../services/transcription.service.js";
import { storageService } from "../services/storage.service.js";
import { notifyAPI } from "../services/workerNotifier.service.js";
import { knowledgeQueue, intelligenceQueue } from "../services/queue.service.js";
import { usageService } from "../services/billing/usage.service.js";

export const transcriptionWorker = new Worker("transcription", async (job) => {
    const { transcriptId, recordingId, meetingCode, organizationId } = job.data;

    if (!transcriptId || !recordingId || !meetingCode || !organizationId) {
        throw new Error("Missing required parameters in transcription job");
    }

    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
        throw new Error(`Transcript not found: ${transcriptId}`);
    }

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) {
        throw new Error(`Meeting not found: ${meetingCode}`);
    }

    if (meeting.organization.toString() !== organizationId) {
        throw new Error("Tenant isolation violation: meeting organization mismatch");
    }

    const recording = meeting.recordings.id(recordingId);
    if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
    }

    // Set status to processing
    transcript.status = "processing";
    await transcript.save();

    notifyAPI("transcription", meetingCode, "meeting:transcription-processing", {
        meetingCode,
        recordingId,
        provider: transcript.provider,
        status: "processing"
    });

    try {
        const filePath = storageService.getFilePath(recording.storageKey);
        const result = await transcriptionService.transcribeRecording({
            filePath,
            storageKey: recording.storageKey,
            language: "en",
            duration: recording.duration || 0
        });

        transcript.status = "completed";
        transcript.segments = result.segments;
        transcript.rawText = result.rawText;
        transcript.duration = result.duration || recording.duration || 0;
        transcript.language = result.language || "en";
        transcript.completedAt = new Date();
        transcript.error = null;
        await transcript.save();

        // Increment usage (ceiling of duration in minutes)
        const minutes = Math.max(1, Math.ceil(transcript.duration / 60));
        await usageService.incrementUsage(organizationId, "transcription_minutes", minutes);

        notifyAPI("transcription", meetingCode, "meeting:transcription-completed", {
            meetingCode,
            recordingId,
            provider: transcript.provider,
            status: "completed",
            duration: transcript.duration,
            segmentCount: transcript.segments.length
        });

        // Trigger Knowledge indexing
        await knowledgeQueue.add("index_transcript", {
            transcriptId: transcript._id.toString(),
            meetingCode,
            organizationId
        });

        // Intelligence could also be triggered here if there's an auto-AI setting,
        // but currently it is manual via getMeetingIntelligence / startMeetingIntelligence.
        // Wait, the test might not start it manually? It does start it manually.

        return { success: true, transcriptId: transcript._id };
    } catch (err) {
        console.error(`Transcription error for recording ${recordingId}:`, err.message);
        transcript.status = "failed";
        transcript.error = err.message || "Transcription failed";
        await transcript.save().catch(() => {});

        notifyAPI("transcription", meetingCode, "meeting:transcription-failed", {
            meetingCode,
            recordingId,
            provider: transcript.provider,
            status: "failed",
            error: "Transcription failed. Please try again."
        });

        throw err; // Allow BullMQ to retry if transient
    }
}, { connection });

transcriptionWorker.on("failed", (job, err) => {
    console.error(`Job ${job.id} failed with error: ${err.message}`);
});
