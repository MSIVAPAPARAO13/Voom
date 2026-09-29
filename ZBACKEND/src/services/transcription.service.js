import fs from "fs";
import path from "path";
import OpenAI from "openai";

/**
 * Base Transcription Provider Interface
 *
 * Why a provider abstraction exists:
 * The controller (meeting.controller.js) must never contain AssemblyAI-specific or
 * Deepgram-specific logic. All provider differences — upload flow, polling, timestamp
 * units, segment structure — are encapsulated here. Switching providers is a single
 * env var change (TRANSCRIPTION_PROVIDER=deepgram).
 */
class BaseTranscriptionProvider {
    /**
     * Accept optional apiKey parameter so unit tests can instantiate with a dummy key
     * without needing a real env var. The env var is still the production source.
     */
    constructor(apiKey) {
        this._apiKey = apiKey || null;
    }

    getName() {
        throw new Error("getName() must be implemented by provider");
    }

    async transcribe({ filePath, storageKey, language, duration }) {
        throw new Error("transcribe() must be implemented by provider");
    }

    async transcribeRecording(params) {
        return this.transcribe(params);
    }

    /**
     * normalizeTranscript() is exposed as a PUBLIC method so that:
     * 1. Unit tests can call it with mock provider responses without making HTTP calls.
     * 2. The TranscriptionService.validateAndNormalizeTranscript() provides a second
     *    pass of structural validation AFTER provider normalization.
     */
    normalizeTranscript(data) {
        throw new Error("normalizeTranscript() must be implemented by provider");
    }
}

/**
 * AssemblyAI Transcription Provider
 *
 * Uses AssemblyAI Prerecorded Audio API:
 * 1. Uploads file buffer to POST https://api.assemblyai.com/v2/upload
 * 2. Submits transcription request to POST https://api.assemblyai.com/v2/transcript
 * 3. Polls GET https://api.assemblyai.com/v2/transcript/:id until completion
 * 4. Normalizes timestamps from milliseconds to seconds (AssemblyAI uses ms)
 *
 * Timestamp normalization: AssemblyAI returns start/end in milliseconds.
 * We convert ms → seconds with 2 decimal places (e.g. 4200ms → 4.2s).
 * This is the inverse of how video players seek (videoRef.currentTime = seconds).
 */
class AssemblyAIProvider extends BaseTranscriptionProvider {
    constructor(apiKey) {
        super(apiKey);
    }

    get apiKey() {
        return this._apiKey || process.env.ASSEMBLYAI_API_KEY || process.env.Assembly_API;
    }

    getName() {
        return "assemblyai";
    }

    /**
     * normalizeTranscript() converts a raw AssemblyAI API response into Voom's
     * provider-agnostic segment format. Called both from transcribe() and directly
     * by unit tests (which pass mock data without making real HTTP calls).
     */
    normalizeTranscript(completedData, duration = 0, language = "en") {
        const segments = [];

        if (Array.isArray(completedData.utterances) && completedData.utterances.length > 0) {
            // Utterances carry speaker diarization — preserve it faithfully.
            // AssemblyAI speaker is a letter (A, B, C…). Format as "Speaker A".
            for (const utt of completedData.utterances) {
                segments.push({
                    start: Number((utt.start / 1000).toFixed(2)),
                    end: Number((utt.end / 1000).toFixed(2)),
                    text: utt.text.trim(),
                    speaker: utt.speaker ? `Speaker ${utt.speaker}` : null
                });
            }
        } else if (Array.isArray(completedData.words) && completedData.words.length > 0) {
            // Fallback: group words into ~sentence segments by punctuation or 8-word cap.
            // Avoids storing every individual word as a segment in MongoDB.
            let currentWords = [];
            let segStart = completedData.words[0].start / 1000;

            for (const w of completedData.words) {
                currentWords.push(w.text);
                const isPunct = /[.!?]$/.test(w.text);
                if (isPunct || currentWords.length >= 8) {
                    segments.push({
                        start: Number(segStart.toFixed(2)),
                        end: Number((w.end / 1000).toFixed(2)),
                        text: currentWords.join(" ").trim(),
                        speaker: w.speaker ? `Speaker ${w.speaker}` : null
                    });
                    currentWords = [];
                    segStart = w.end / 1000;
                }
            }
            if (currentWords.length > 0) {
                const lastWord = completedData.words[completedData.words.length - 1];
                segments.push({
                    start: Number(segStart.toFixed(2)),
                    end: Number((lastWord.end / 1000).toFixed(2)),
                    text: currentWords.join(" ").trim(),
                    speaker: null
                });
            }
        } else if (completedData.text) {
            // Last resort: single segment spanning full duration
            segments.push({
                start: 0.0,
                end: Number((completedData.audio_duration || duration || 1).toFixed(2)),
                text: completedData.text.trim(),
                speaker: null
            });
        }

        return {
            provider: "assemblyai",
            language: completedData.language_code || language,
            duration: completedData.audio_duration ? Math.round(completedData.audio_duration) : duration,
            segments,
            rawText: completedData.text || segments.map(s => s.text).join(" ")
        };
    }

    async transcribe({ filePath, storageKey, language = "en", duration = 0 }) {
        if (!this.apiKey) {
            throw new Error("AssemblyAI API key not configured. Set ASSEMBLYAI_API_KEY or Assembly_API in .env");
        }

        if (!fs.existsSync(filePath)) {
            throw new Error(`Recording file not found on disk: ${filePath}`);
        }

        // 1. Upload media file to AssemblyAI
        const fileBuffer = await fs.promises.readFile(filePath);
        const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
            method: "POST",
            headers: {
                "Authorization": this.apiKey,
                "Content-Type": "application/octet-stream"
            },
            body: fileBuffer
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`AssemblyAI upload failed (${uploadResponse.status}): ${errorText}`);
        }

        const uploadData = await uploadResponse.json();
        const audioUrl = uploadData.upload_url;

        // 2. Submit transcription job
        const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
            method: "POST",
            headers: {
                "Authorization": this.apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                audio_url: audioUrl,
                speaker_labels: true,
                language_code: language === "auto" ? undefined : language
            })
        });

        if (!transcriptResponse.ok) {
            const errorText = await transcriptResponse.text();
            throw new Error(`AssemblyAI transcription submission failed (${transcriptResponse.status}): ${errorText}`);
        }

        const transcriptJob = await transcriptResponse.json();
        const transcriptId = transcriptJob.id;

        // 3. Poll for completion (up to 3 minutes)
        let completedData = null;
        const maxAttempts = 60;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 3000));

            const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                method: "GET",
                headers: { "Authorization": this.apiKey }
            });

            if (!pollResponse.ok) {
                const errorText = await pollResponse.text();
                throw new Error(`AssemblyAI polling failed: ${errorText}`);
            }

            const pollData = await pollResponse.json();
            if (pollData.status === "completed") {
                completedData = pollData;
                break;
            } else if (pollData.status === "error") {
                throw new Error(`AssemblyAI transcription error: ${pollData.error || "Unknown error"}`);
            }
        }

        if (!completedData) {
            throw new Error("AssemblyAI transcription timed out waiting for completion");
        }

        // 4. Normalize using the shared public method (same code used in unit tests)
        return this.normalizeTranscript(completedData, duration, language);
    }
}

/**
 * Deepgram Transcription Provider
 *
 * Uses Deepgram Prerecorded Audio API:
 * POST https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true
 * Sends raw audio buffer directly and receives instantaneous structured JSON.
 *
 * Deepgram returns timestamps already in seconds (not ms), so no division needed.
 * Prefer paragraph/sentence segments when available to avoid word-level MongoDB noise.
 */
class DeepgramProvider extends BaseTranscriptionProvider {
    constructor(apiKey) {
        super(apiKey);
    }

    get apiKey() {
        return this._apiKey || process.env.DEEPGRAM_API_KEY || process.env.Deepgram_API;
    }

    getName() {
        return "deepgram";
    }

    /**
     * normalizeTranscript() converts a raw Deepgram API response into Voom's
     * provider-agnostic segment format. Deepgram timestamps are already in seconds.
     * Called both from transcribe() and directly by unit tests.
     */
    normalizeTranscript(result, duration = 0, language = "en") {
        const alternative = result?.results?.channels?.[0]?.alternatives?.[0];

        if (!alternative) {
            throw new Error("Deepgram returned no transcription alternatives");
        }

        const segments = [];
        const paragraphs = alternative.paragraphs?.paragraphs;

        if (Array.isArray(paragraphs) && paragraphs.length > 0) {
            // Use paragraph/sentence structure when available — produces meaningful segments.
            // Speaker field from Deepgram is a number (0, 1, 2…). Format as "Speaker 0".
            for (const p of paragraphs) {
                // Use sentence-level segments within each paragraph for better granularity
                if (Array.isArray(p.sentences) && p.sentences.length > 0) {
                    for (const sentence of p.sentences) {
                        segments.push({
                            start: Number((sentence.start || p.start || 0).toFixed(2)),
                            end: Number((sentence.end || p.end || 0).toFixed(2)),
                            text: sentence.text.trim(),
                            speaker: p.speaker !== undefined ? `Speaker ${p.speaker}` : null
                        });
                    }
                } else {
                    const paraText = p.text || alternative.transcript || "";
                    segments.push({
                        start: Number((p.start || 0).toFixed(2)),
                        end: Number((p.end || 0).toFixed(2)),
                        text: paraText.trim(),
                        speaker: p.speaker !== undefined ? `Speaker ${p.speaker}` : null
                    });
                }
            }
        } else if (Array.isArray(alternative.words) && alternative.words.length > 0) {
            // Fallback: group words by punctuation or 8-word cap
            let currentWords = [];
            let segStart = alternative.words[0].start;

            for (const w of alternative.words) {
                currentWords.push(w.punctuated_word || w.word);
                const isPunct = /[.!?]$/.test(w.punctuated_word || w.word);
                if (isPunct || currentWords.length >= 8) {
                    segments.push({
                        start: Number(segStart.toFixed(2)),
                        end: Number((w.end || segStart + 1).toFixed(2)),
                        text: currentWords.join(" ").trim(),
                        speaker: w.speaker !== undefined ? `Speaker ${w.speaker}` : null
                    });
                    currentWords = [];
                    segStart = w.end;
                }
            }
            if (currentWords.length > 0) {
                const lastWord = alternative.words[alternative.words.length - 1];
                segments.push({
                    start: Number(segStart.toFixed(2)),
                    end: Number((lastWord.end || segStart + 1).toFixed(2)),
                    text: currentWords.join(" ").trim(),
                    speaker: null
                });
            }
        } else if (alternative.transcript) {
            segments.push({
                start: 0.0,
                end: Number((duration || 1).toFixed(2)),
                text: alternative.transcript.trim(),
                speaker: null
            });
        }

        return {
            provider: "deepgram",
            language: language,
            duration: duration,
            segments,
            rawText: alternative.transcript || segments.map(s => s.text).join(" ")
        };
    }

    async transcribe({ filePath, storageKey, language = "en", duration = 0 }) {
        if (!this.apiKey) {
            throw new Error("Deepgram API key not configured. Set DEEPGRAM_API_KEY or Deepgram_API in .env");
        }

        if (!fs.existsSync(filePath)) {
            throw new Error(`Recording file not found on disk: ${filePath}`);
        }

        const fileBuffer = await fs.promises.readFile(filePath);

        const url = new URL("https://api.deepgram.com/v1/listen");
        url.searchParams.set("model", "nova-2");
        url.searchParams.set("smart_format", "true");
        url.searchParams.set("diarize", "true");
        url.searchParams.set("punctuate", "true");
        if (language && language !== "auto") {
            url.searchParams.set("language", language);
        }

        const response = await fetch(url.toString(), {
            method: "POST",
            headers: {
                "Authorization": `Token ${this.apiKey}`,
                "Content-Type": "video/webm"
            },
            body: fileBuffer
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Deepgram transcription failed (${response.status}): ${errorText}`);
        }

        const result = await response.json();

        // Normalize using the shared public method (same code used in unit tests)
        return this.normalizeTranscript(result, duration, language);
    }
}

/**
 * OpenAI Transcription Provider
 *
 * Uses the official OpenAI Node SDK with the Whisper audio transcription endpoint:
 * POST https://api.openai.com/v1/audio/transcriptions
 *
 * Model: configurable via OPENAI_TRANSCRIPTION_MODEL env var (default: whisper-1).
 * Model knowledge is fully encapsulated here — the controller is unaware.
 *
 * Accepted formats by the OpenAI Whisper API: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm.
 * Voom recordings are stored as video/webm — NO format conversion is required.
 *
 * Timestamp handling:
 * verbose_json response returns segment timestamps already in SECONDS (float).
 * No unit conversion needed — segment.start/end are used directly.
 *
 * Speaker diarization:
 * The Whisper API does NOT provide speaker labels. All segments have speaker = null.
 * No fabricated "Speaker 1 / Speaker 2" labels are generated.
 *
 * Security:
 * OPENAI_API_KEY is read only on the backend via a dynamic getter.
 * It is NEVER logged, returned in API responses, sent via Socket.IO, or stored in MongoDB.
 */
class OpenAITranscriptionProvider extends BaseTranscriptionProvider {
    constructor(apiKey) {
        super(apiKey);
    }

    get apiKey() {
        if (this._apiKey !== undefined && this._apiKey !== null) {
            return this._apiKey;
        }
        return process.env.OPENAI_API_KEY || "";
    }

    get model() {
        return process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1";
    }

    getName() {
        return "openai";
    }

    /**
     * normalizeTranscript() converts a raw OpenAI verbose_json response into Voom's
     * provider-agnostic segment format. Called from transcribe() and by unit tests.
     *
     * OpenAI verbose_json segment fields used:
     *   segment.start — float seconds (e.g. 0.0, 4.2)
     *   segment.end   — float seconds (e.g. 4.2, 8.6)
     *   segment.text  — transcribed text (may have leading whitespace from Whisper)
     *
     * Speaker: Whisper API does not provide diarization — speaker is always null.
     */
    normalizeTranscript(data, duration = 0, language = "en") {
        const segments = [];

        if (data && Array.isArray(data.segments) && data.segments.length > 0) {
            for (const seg of data.segments) {
                const text = (seg.text || "").trim();
                if (!text) continue;

                const start = typeof seg.start === "number" ? seg.start : parseFloat(seg.start) || 0;
                const end = typeof seg.end === "number" ? seg.end : parseFloat(seg.end) || start;

                segments.push({
                    start: Number(Math.max(0, start).toFixed(2)),
                    end: Number(Math.max(start, end).toFixed(2)),
                    text,
                    speaker: null
                });
            }
        } else if (data && data.text) {
            // Fallback: non-verbose response or empty segments array — single full-duration segment
            const text = (data.text || "").trim();
            if (text) {
                segments.push({
                    start: 0.0,
                    end: Number(Math.max(1, duration).toFixed(2)),
                    text,
                    speaker: null
                });
            }
        }

        const rawText = segments.map(s => s.text).join(" ") || (data && data.text ? data.text.trim() : "");

        if (!rawText) {
            throw new Error("OpenAI transcription returned an empty transcript. The recording may be silent or the audio format may be unsupported.");
        }

        return {
            provider: "openai",
            language: (data && data.language) ? data.language : language,
            duration: (data && typeof data.duration === "number") ? data.duration : (duration || 0),
            segments,
            rawText
        };
    }

    async transcribe({ filePath, storageKey, language = "en", duration = 0 }) {
        if (!this.apiKey) {
            throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in .env");
        }

        if (!fs.existsSync(filePath)) {
            throw new Error(`Recording file not found on disk: ${filePath}`);
        }

        const client = new OpenAI({ apiKey: this.apiKey });
        const fileStream = fs.createReadStream(filePath);

        let response;
        try {
            response = await client.audio.transcriptions.create({
                file: fileStream,
                model: this.model,
                response_format: "verbose_json",
                timestamp_granularities: ["segment"],
                ...(language && language !== "auto" ? { language } : {})
            });
        } catch (err) {
            // Scrub any potential key leakage from SDK error messages
            const safeMessage = (err.message || "OpenAI transcription request failed")
                .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
                .replace(/sk-\S+/gi, "[REDACTED]");

            if (err.status === 401) {
                throw new Error("OpenAI transcription failed: Invalid or expired API key");
            }
            if (err.status === 400) {
                throw new Error(`OpenAI transcription failed: Unsupported media format or malformed request`);
            }
            if (err.status === 429) {
                throw new Error("OpenAI transcription failed: Rate limit exceeded. Please retry later.");
            }
            throw new Error(`OpenAI transcription failed: ${safeMessage}`);
        }

        return this.normalizeTranscript(response, duration, language);
    }
}

/**
 * Mock Transcription Provider
 *
 * Returns deterministic fixture segments without any external network calls.
 * Used for automated regression tests so the entire suite does not depend on
 * AssemblyAI or Deepgram availability. TRANSCRIPTION_PROVIDER=mock-whisper enables it.
 *
 * The fixture content is deliberately crafted to match what the test suite searches for
 * (e.g. "architecture", "authentication") to enable end-to-end search validation.
 */
class MockTranscriptionProvider extends BaseTranscriptionProvider {
    constructor(apiKey) {
        super(apiKey);
    }

    getName() {
        return "mock-whisper";
    }

    normalizeTranscript(data, duration = 9, language = "en") {
        // Mock normalization simply returns the same data structure
        return {
            provider: "mock-whisper",
            language,
            duration: Math.max(duration, 9),
            segments: data.segments || [],
            rawText: (data.segments || []).map(s => s.text).join(" ")
        };
    }

    async transcribe({ filePath, storageKey, language = "en", duration = 12 }) {
        const segDuration = Math.max(2, Math.floor(duration / 3) || 3);
        const segments = [
            {
                start: 0.0,
                end: Number(segDuration.toFixed(2)),
                text: "Welcome everyone to the meeting.",
                speaker: "Speaker 0"
            },
            {
                start: Number(segDuration.toFixed(2)),
                end: Number((segDuration * 2).toFixed(2)),
                text: "Today we will discuss the backend architecture and authentication.",
                speaker: "Speaker 1"
            },
            {
                start: Number((segDuration * 2).toFixed(2)),
                end: Number(Math.max(segDuration * 3, duration || 9).toFixed(2)),
                text: "Let's review the transcription search and video seeking features.",
                speaker: "Speaker 0"
            }
        ];

        return {
            provider: "mock-whisper",
            language,
            duration: Math.max(duration, 9),
            segments,
            rawText: segments.map(s => s.text).join(" ")
        };
    }
}

/**
 * Unified Transcription Service
 *
 * Why this service layer exists:
 * - Provider selection is driven entirely by TRANSCRIPTION_PROVIDER env var
 * - Controllers call transcriptionService.transcribeRecording() without knowing the provider
 * - validateAndNormalizeTranscript() guarantees uniform segment structure regardless of provider
 * - Future: background-worker integration would call transcribeRecording() from a queue consumer
 *   instead of the async IIFE in the controller — no provider code would change
 */
class TranscriptionService {
    constructor() {
        this.providers = {
            "assemblyai": new AssemblyAIProvider(),
            "deepgram": new DeepgramProvider(),
            "openai": new OpenAITranscriptionProvider(),
            "mock-whisper": new MockTranscriptionProvider()
        };
    }

    /**
     * Resolve active provider based on TRANSCRIPTION_PROVIDER env var.
     * Fails safely with a clear error — not a silent fallback — if misconfigured.
     */
    getProvider() {
        const configured = (process.env.TRANSCRIPTION_PROVIDER || "assemblyai").toLowerCase().trim();
        const provider = this.providers[configured];
        if (!provider) {
            throw new Error(`Unsupported transcription provider: '${configured}'. Supported: assemblyai, deepgram, openai, mock-whisper`);
        }
        return provider;
    }

    getProviderName() {
        return this.getProvider().getName();
    }

    /**
     * Transcribe recording and return validated, normalized transcript.
     *
     * Why REST is authoritative (not Socket.IO):
     * Socket.IO events are best-effort delivery. If a client disconnects and reconnects,
     * or joins late, they must poll the REST status endpoint to get the current state.
     * The database is the source of truth; sockets only push delta notifications.
     */
    async transcribeRecording({ filePath, storageKey, language = "en", duration = 0 }) {
        const provider = this.getProvider();
        const rawResult = await provider.transcribe({ filePath, storageKey, language, duration });
        return this.validateAndNormalizeTranscript(rawResult);
    }

    /**
     * Second-pass structural validation after provider normalization.
     * Ensures every segment that enters MongoDB has the correct shape regardless
     * of any edge cases in provider response handling.
     */
    validateAndNormalizeTranscript(result) {
        if (!result || typeof result !== "object") {
            throw new Error("Transcription provider returned invalid result structure");
        }

        const segments = [];
        if (Array.isArray(result.segments)) {
            for (const seg of result.segments) {
                if (typeof seg.start === "number" && typeof seg.end === "number" && typeof seg.text === "string") {
                    segments.push({
                        start: Math.max(0, Number(seg.start.toFixed(2))),
                        end: Math.max(seg.start, Number(seg.end.toFixed(2))),
                        text: seg.text.trim(),
                        speaker: seg.speaker ? String(seg.speaker).trim() : null
                    });
                }
            }
        }

        const rawText = result.rawText ? String(result.rawText).trim() : segments.map(s => s.text).join(" ");

        return {
            provider: result.provider || this.getProviderName(),
            language: result.language || "en",
            duration: typeof result.duration === "number" ? result.duration : 0,
            segments,
            rawText
        };
    }
}

export const transcriptionService = new TranscriptionService();
export default transcriptionService;

// Named exports so the test suite can import provider classes directly for unit testing
// normalizeTranscript() without making real HTTP calls.
export { AssemblyAIProvider, DeepgramProvider, OpenAITranscriptionProvider, MockTranscriptionProvider };
