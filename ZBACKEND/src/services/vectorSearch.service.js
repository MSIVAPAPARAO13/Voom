import logger from "../utils/logger.js";
import { KnowledgeChunk } from "../models/knowledgeChunk.model.js";
import { generateEmbedding } from "./embedding.service.js";
import mongoose from "mongoose";

/**
 * Searches the organization's knowledge chunks using vector search.
 *
 * @param {Object} params
 * @param {string} params.organizationId - Required. The tenant ID.
 * @param {string} params.query - The search query.
 * @param {number} params.limit - Max results to return.
 * @param {string} params.meetingId - Optional meeting filter.
 * @param {Date} params.dateFrom - Optional start date filter.
 * @param {Date} params.dateTo - Optional end date filter.
 */
export const searchOrganizationKnowledge = async ({
    organizationId,
    query,
    limit = 5,
    meetingId = null,
    dateFrom = null,
    dateTo = null
}) => {
    if (!organizationId) {
        throw new Error("organizationId is mandatory for vector search");
    }

    const queryEmbedding = await generateEmbedding(query);

    // Build the $match pipeline for pre-filtering (filtering before vector search for efficiency and strict tenant isolation)
    // Note: $vectorSearch supports `filter` natively in MongoDB Atlas.
    const filter = {
        organization: new mongoose.Types.ObjectId(organizationId)
    };

    if (meetingId) {
        filter.meeting = new mongoose.Types.ObjectId(meetingId);
    }

    const provider = process.env.EMBEDDING_PROVIDER || "openai";

    if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // If we are using mock embeddings in a local dev environment, we should use standard MongoDB aggregation without $vectorSearch 
    // to guarantee test stability, unless TEST_REAL_VECTOR_SEARCH is explicitly enabled.
    if (provider === "mock" && process.env.TEST_REAL_VECTOR_SEARCH !== "true") {
        logger.info("Using mock vector search fallback");
        const chunks = await KnowledgeChunk.find(filter).limit(limit).populate("meeting", "title meetingCode");
        return chunks.map((chunk, idx) => ({
            chunkId: chunk._id,
            meetingId: chunk.meeting?._id,
            meetingCode: chunk.meeting?.meetingCode,
            meetingTitle: chunk.meeting?.title,
            recordingId: chunk.recordingId,
            transcriptId: chunk.transcriptId,
            text: chunk.text,
            score: 1.0 - (idx * 0.1), // Fake score
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            sourceType: chunk.sourceType
        }));
    }
    
    try {
        const pipeline = [
            {
                $vectorSearch: {
                    index: "voom_knowledge_vector_index", // MUST match the index name configured in Atlas
                    path: "embedding",
                    queryVector: queryEmbedding,
                    numCandidates: limit * 10,
                    limit: limit,
                    filter: filter
                }
            },
            {
                $project: {
                    _id: 0,
                    chunkId: "$_id",
                    meetingId: "$meeting",
                    recordingId: "$recordingId",
                    transcriptId: "$transcriptId",
                    sourceType: 1,
                    text: 1,
                    startTime: 1,
                    endTime: 1,
                    score: { $meta: "vectorSearchScore" }
                }
            }
        ];

        // The $vectorSearch MUST be the first stage. We execute the aggregation on the collection.
        const chunks = await KnowledgeChunk.aggregate(pipeline);

        // Populate meeting details manually since $lookup after $vectorSearch can be slow
        await KnowledgeChunk.populate(chunks, { path: "meetingId", select: "title meetingCode", model: "Meeting" });

        return chunks.map(chunk => ({
            chunkId: chunk.chunkId,
            meetingId: chunk.meetingId._id,
            meetingCode: chunk.meetingId.meetingCode,
            meetingTitle: chunk.meetingId.title,
            recordingId: chunk.recordingId,
            transcriptId: chunk.transcriptId,
            text: chunk.text,
            score: chunk.score,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            sourceType: chunk.sourceType
        }));
    } catch (error) {
        throw error; // Rethrow real errors
    }
};
