import logger from "../utils/logger.js";
import { Worker } from "bullmq";
import { connection } from "../config/redis.js";
import { Transcript } from "../models/transcript.model.js";
import { Meeting } from "../models/meeting.model.js";
import { indexTranscript } from "../services/knowledgeIndex.service.js";

export const knowledgeWorker = new Worker("knowledge", async (job) => {
    const { transcriptId, meetingCode, organizationId } = job.data;

    if (!transcriptId || !meetingCode || !organizationId) {
        throw new Error("Missing required parameters in knowledge job");
    }

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting || meeting.organization.toString() !== organizationId) {
        throw new Error("Tenant isolation violation or missing meeting");
    }

    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
        throw new Error(`Transcript not found: ${transcriptId}`);
    }

    try {
        await indexTranscript(transcriptId);
        return { success: true };
    } catch (err) {
        logger.error(`Knowledge indexing failed for transcript ${transcriptId}:`, err.message);
        throw err;
    }
}, { connection });

knowledgeWorker.on("failed", (job, err) => {
    logger.error(`Knowledge Job ${job.id} failed: ${err.message}`);
});
