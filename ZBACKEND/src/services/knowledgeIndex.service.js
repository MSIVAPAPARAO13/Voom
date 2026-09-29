import { KnowledgeChunk } from "../models/knowledgeChunk.model.js";
import { Transcript } from "../models/transcript.model.js";
import { MeetingIntelligence } from "../models/meetingIntelligence.model.js";
import { chunkTranscript } from "./knowledgeChunk.service.js";
import { generateEmbeddings } from "./embedding.service.js";

/**
 * Deletes all knowledge chunks for a given transcript.
 * @param {string} transcriptId 
 */
export const deleteTranscriptKnowledge = async (transcriptId) => {
    await KnowledgeChunk.deleteMany({ transcriptId });
};

/**
 * Indexes a transcript and its intelligence into the vector store.
 * @param {string} transcriptId 
 */
export const indexTranscript = async (transcriptId) => {
    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
        throw new Error("Transcript not found");
    }

    if (transcript.status !== "completed") {
        throw new Error("Only completed transcripts can be indexed.");
    }

    // Prepare all items to embed
    const itemsToEmbed = [];

    // 1. Process transcript segments
    const transcriptChunks = chunkTranscript(transcript.segments);
    for (const chunk of transcriptChunks) {
        itemsToEmbed.push({
            organization: transcript.organization,
            meeting: transcript.meeting,
            recordingId: transcript.recordingId,
            transcriptId: transcript._id,
            sourceType: "transcript_segment",
            sourceId: chunk.sourceId,
            text: chunk.text,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            metadata: {}
        });
    }

    // 2. Process Meeting Intelligence if it exists
    const intelligence = await MeetingIntelligence.findOne({ transcriptId: transcript._id, status: "completed" });
    if (intelligence) {
        if (intelligence.summary) {
            itemsToEmbed.push({
                organization: transcript.organization,
                meeting: transcript.meeting,
                recordingId: transcript.recordingId,
                transcriptId: transcript._id,
                sourceType: "meeting_summary",
                sourceId: "meeting_summary",
                text: `Meeting Summary: ${intelligence.summary}`,
                startTime: null,
                endTime: null,
                metadata: {}
            });
        }

        intelligence.keyPoints.forEach((kp, idx) => {
            itemsToEmbed.push({
                organization: transcript.organization,
                meeting: transcript.meeting,
                recordingId: transcript.recordingId,
                transcriptId: transcript._id,
                sourceType: "meeting_key_point",
                sourceId: `meeting_key_point_${idx}`,
                text: `Key Point: ${kp}`,
                startTime: null,
                endTime: null,
                metadata: {}
            });
        });

        intelligence.decisions.forEach((dec, idx) => {
            itemsToEmbed.push({
                organization: transcript.organization,
                meeting: transcript.meeting,
                recordingId: transcript.recordingId,
                transcriptId: transcript._id,
                sourceType: "meeting_decision",
                sourceId: `meeting_decision_${idx}`,
                text: `Decision: ${dec.text}`,
                startTime: dec.timestamp,
                endTime: dec.timestamp,
                metadata: {}
            });
        });

        intelligence.actionItems.forEach((ai, idx) => {
            itemsToEmbed.push({
                organization: transcript.organization,
                meeting: transcript.meeting,
                recordingId: transcript.recordingId,
                transcriptId: transcript._id,
                sourceType: "meeting_action_item",
                sourceId: `meeting_action_item_${idx}`,
                text: `Action Item: ${ai.task} (Assigned to: ${ai.assignee || 'Unassigned'}, Due: ${ai.dueDate || 'No due date'})`,
                startTime: ai.timestamp,
                endTime: ai.timestamp,
                metadata: {}
            });
        });
    }

    if (itemsToEmbed.length === 0) return;

    // Generate embeddings in batches
    const batchSize = 50;
    for (let i = 0; i < itemsToEmbed.length; i += batchSize) {
        const batch = itemsToEmbed.slice(i, i + batchSize);
        const textsToEmbed = batch.map(b => b.text);
        
        const embeddings = await generateEmbeddings(textsToEmbed);
        
        for (let j = 0; j < batch.length; j++) {
            batch[j].embedding = embeddings[j];
        }

        // Upsert chunks to prevent duplicates
        const bulkOps = batch.map(doc => ({
            updateOne: {
                filter: {
                    organization: doc.organization,
                    transcriptId: doc.transcriptId,
                    sourceType: doc.sourceType,
                    sourceId: doc.sourceId
                },
                update: { $set: doc },
                upsert: true
            }
        }));

        await KnowledgeChunk.bulkWrite(bulkOps);
    }
};

/**
 * Explicitly forces re-indexing of a transcript.
 * @param {string} transcriptId 
 */
export const reindexTranscript = async (transcriptId) => {
    await deleteTranscriptKnowledge(transcriptId);
    await indexTranscript(transcriptId);
};
