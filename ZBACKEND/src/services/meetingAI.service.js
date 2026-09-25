import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod.js";

/**
 * Meeting AI Intelligence Service
 *
 * Transforms completed meeting transcripts into structured intelligence
 * (Summary, Key Points, Decisions, Action Items, Topics) using OpenAI's
 * Responses API and Zod Structured Outputs.
 */
class MeetingAIService {
    get apiKey() {
        return process.env.OPENAI_API_KEY || "";
    }

    get model() {
        return process.env.OPENAI_AI_MODEL || "gpt-4o-mini";
    }

    /**
     * Generates structured meeting intelligence from transcript segments/rawText.
     * Uses OpenAI's Responses API and Zod to guarantee format.
     */
    async generateMeetingIntelligence(transcriptData) {
        if (!this.apiKey) {
            throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in .env");
        }

        const client = new OpenAI({ apiKey: this.apiKey });

        // Build the transcript text for the prompt
        let transcriptContent = "";
        if (transcriptData.segments && transcriptData.segments.length > 0) {
            transcriptContent = transcriptData.segments
                .map(seg => `[${seg.start}] ${seg.speaker ? seg.speaker + ": " : ""}${seg.text}`)
                .join("\n");
        } else {
            transcriptContent = transcriptData.rawText || "No transcript content available.";
        }

        const systemPrompt = `You are a professional Meeting AI assistant.
Your task is to analyze the provided meeting transcript and extract structured intelligence.

CRITICAL INSTRUCTIONS:
- ONLY analyze the provided transcript.
- DO NOT invent facts, people, dates, or decisions.
- DO NOT hallucinate. If an assignee or due date is not explicitly mentioned, use null.
- If a timestamp is not associated with a decision or action item, use null.
- Preserve timestamps strictly as numbers (seconds) exactly as they appear in the transcript tags [timestamp].
- Distinguish explicit decisions from mere suggestions.
- Distinguish action items (commitments to do something) from general discussion.
- Return a concise, professional summary.
- Key Points should be 5-10 meaningful bullet points, depending on length.`;

        // Define Zod schema for structured output
        const DecisionSchema = z.object({
            text: z.string().describe("The explicit decision made."),
            timestamp: z.number().nullable().describe("The timestamp in seconds from the transcript where this decision was made.")
        }).strict();

        const ActionItemSchema = z.object({
            task: z.string().describe("The task to be completed."),
            assignee: z.string().nullable().describe("The person assigned to the task. null if unknown."),
            dueDate: z.string().nullable().describe("The due date for the task. null if unknown."),
            timestamp: z.number().nullable().describe("The timestamp in seconds from the transcript where this was assigned.")
        }).strict();

        const MeetingIntelligenceSchema = z.object({
            summary: z.string().describe("A concise but useful summary of the meeting's purpose, major discussion, and conclusions."),
            keyPoints: z.array(z.string()).describe("Meaningful discussion points extracted from the meeting."),
            decisions: z.array(DecisionSchema),
            actionItems: z.array(ActionItemSchema),
            topics: z.array(z.string()).describe("Meaningful topics discussed. Avoid generic words like 'Meeting'.")
        }).strict();

        try {
            const response = await client.responses.parse({
                model: this.model,
                input: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Meeting Transcript:\n\n${transcriptContent}` }
                ],
                text: {
                    format: zodTextFormat(MeetingIntelligenceSchema, "meeting_intelligence")
                },
                temperature: 0.1
            });

            const intelligence = response.output_parsed;
            if (!intelligence) {
                throw new Error("Received empty parsed response from OpenAI.");
            }

            return this.validateAndNormalizeIntelligence(intelligence);
        } catch (error) {
            // Scrub API keys from errors
            let safeMessage = error.message || "AI processing failed";
            if (safeMessage.includes("sk-")) {
                safeMessage = safeMessage.replace(/sk-[a-zA-Z0-9_-]+/g, "[REDACTED]");
            }
            throw new Error(safeMessage);
        }
    }

    /**
     * Extra safety validation before saving to DB
     */
    validateAndNormalizeIntelligence(data) {
        return {
            summary: typeof data.summary === "string" ? data.summary : "",
            keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
            decisions: Array.isArray(data.decisions) ? data.decisions.map(d => ({
                text: String(d.text || ""),
                timestamp: typeof d.timestamp === "number" ? d.timestamp : null
            })) : [],
            actionItems: Array.isArray(data.actionItems) ? data.actionItems.map(a => ({
                task: String(a.task || ""),
                assignee: typeof a.assignee === "string" ? a.assignee : null,
                dueDate: typeof a.dueDate === "string" ? a.dueDate : null,
                timestamp: typeof a.timestamp === "number" ? a.timestamp : null
            })) : [],
            topics: Array.isArray(data.topics) ? data.topics : []
        };
    }
}

export const meetingAIService = new MeetingAIService();
