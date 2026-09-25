import { searchOrganizationKnowledge } from "./vectorSearch.service.js";
import OpenAI from "openai";

const getOpenAIClient = () => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in .env");
    }
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
};

/**
 * Handles answering organization questions based on meeting memory.
 * 
 * @param {Object} params
 * @param {string} params.organizationId
 * @param {string} params.question
 * @param {string} params.meetingId
 * @param {Date} params.dateFrom
 * @param {Date} params.dateTo
 */
export const askVoom = async ({
    organizationId,
    question,
    meetingId,
    dateFrom,
    dateTo
}) => {
    const topK = process.env.VOOM_RAG_TOP_K ? parseInt(process.env.VOOM_RAG_TOP_K, 10) : 10;
    
    // 1. Vector Search for relevant chunks
    const chunks = await searchOrganizationKnowledge({
        organizationId,
        query: question,
        limit: topK,
        meetingId,
        dateFrom,
        dateTo
    });

    if (!chunks || chunks.length === 0) {
        return {
            answer: "I couldn't find enough information in your organization's meetings to answer that confidently.",
            sources: []
        };
    }

    // 2. Context Assembly
    const contextLines = chunks.map((chunk, i) => {
        return `[Source ${i + 1}] Meeting: ${chunk.meetingTitle} (ID: ${chunk.meetingId}) | Timestamp: ${chunk.startTime !== null ? chunk.startTime : 'N/A'}\nText: ${chunk.text}`;
    });
    const assembledContext = contextLines.join("\n\n");

    const systemPrompt = `You are Voom, an organization meeting knowledge assistant.
Answer only from the supplied meeting context.
Do not invent facts.
Do not invent meetings.
Do not invent people.
Do not invent dates.
Do not invent decisions.
If context is insufficient, say so.
Cite supporting meeting sources using their [Source X] number.
Use timestamps when available.`;

    const userPrompt = `Context:\n${assembledContext}\n\nQuestion: ${question}\n\nAnswer:`;

    // 3. LLM Generation
    const provider = process.env.EMBEDDING_PROVIDER || "openai";
    let answerText = "";

    if (provider === "mock") {
        // Mock generation behavior for tests
        answerText = `MOCK ANSWER: Based on the meetings, here is a mock response. According to [Source 1], we discussed this.`;
    } else {
        const client = getOpenAIClient();
        const model = process.env.OPENAI_AI_MODEL || "gpt-4o-mini";
        
        const response = await client.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.1
        });
        answerText = response.choices[0].message.content;
    }

    // 4. Source parsing
    // Only return sources that were actually cited (or all retrieved sources in this basic version, but ideally filtered by what's cited).
    const sources = chunks.map((chunk, i) => ({
        id: chunk.chunkId,
        sourceNumber: i + 1,
        meetingId: chunk.meetingId,
        meetingCode: chunk.meetingCode,
        meetingTitle: chunk.meetingTitle,
        recordingId: chunk.recordingId,
        transcriptId: chunk.transcriptId,
        timestamp: chunk.startTime,
        text: chunk.text
    }));

    return {
        answer: answerText,
        sources: sources
    };
};
