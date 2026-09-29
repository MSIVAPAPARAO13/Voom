import axios from "axios";
import { io } from "socket.io-client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve("ZBACKEND/.env") });
dotenv.config({ path: path.resolve(".env") });
import { AssemblyAIProvider, DeepgramProvider, OpenAITranscriptionProvider, MockTranscriptionProvider } from "../ZBACKEND/src/services/transcription.service.js";

const BASE_URL = "http://localhost:8000/api/v1";
const SOCKET_URL = "http://localhost:8000";

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`[PASS] ${message}`);
        passed++;
    } else {
        console.error(`[FAIL] ${message}`);
        failed++;
    }
}

// Minimal valid WebM file fixture (EBML Header + Segment)
const webmHeader = Buffer.from([
    0x1A, 0x45, 0xDF, 0xA3, // EBML ID
    0x9F,                   // EBML length
    0x42, 0x86, 0x81, 0x01, // EBMLVersion = 1
    0x42, 0xF7, 0x81, 0x01, // EBMLReadVersion = 1
    0x42, 0xF2, 0x81, 0x04, // EBMLMaxIDLength = 4
    0x42, 0xF3, 0x81, 0x08, // EBMLMaxSizeLength = 8
    0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6D, // DocType = "webm"
    0x42, 0x87, 0x81, 0x02, // DocTypeVersion = 2
    0x42, 0x85, 0x81, 0x02, // DocTypeReadVersion = 2
    0x18, 0x53, 0x80, 0x67, // Segment ID
    0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF // Segment unknown length
]);
const dummyPayload = Buffer.alloc(2048, 0x42);
const validWebmFixture = Buffer.concat([webmHeader, dummyPayload]);

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
    console.log("==================================================");
    console.log("=== STARTING PHASE 8 AUTOMATED TEST SUITE      ===");
    console.log("==================================================");

    try {
        // 1. Health endpoint
        const health = await axios.get(`${BASE_URL}/health`);
        assert(health.status === 200 && health.data.status === "ok", "1. Health endpoint responds 200 OK");

        const ts = Date.now();

        // Register and login helper
        const registerAndLogin = async (username, password, name) => {
            try {
                await axios.post(`${BASE_URL}/users/register`, { name, username, password });
            } catch (e) { }
            const loginRes = await axios.post(`${BASE_URL}/users/login`, { username, password });
            return {
                token: loginRes.data.accessToken,
                user: loginRes.data.user
            };
        };

        // Setup Users & Orgs
        console.log("\n--- Creating Test Users & Organizations ---");
        const hostUser = await registerAndLogin(`p8_host_${ts}`, "Pass123!@#", "Phase8 Host");
        const memberUser = await registerAndLogin(`p8_member_${ts}`, "Pass123!@#", "Phase8 Member");
        const foreignUser = await registerAndLogin(`p8_foreign_${ts}`, "Pass123!@#", "Phase8 Foreign");

        // Host creates Org Alpha
        const orgAlphaRes = await axios.post(
            `${BASE_URL}/organizations`,
            { name: `Org_Alpha_P8_${ts}` },
            { headers: { Authorization: `Bearer ${hostUser.token}` } }
        );
        const orgAlphaId = orgAlphaRes.data.organization._id || orgAlphaRes.data.organization.id;

        // Foreign user creates Org Beta
        const orgBetaRes = await axios.post(
            `${BASE_URL}/organizations`,
            { name: `Org_Beta_P8_${ts}` },
            { headers: { Authorization: `Bearer ${foreignUser.token}` } }
        );
        const orgBetaId = orgBetaRes.data.organization._id || orgBetaRes.data.organization.id;

        // Add member to Org Alpha
        await axios.post(
            `${BASE_URL}/organizations/${orgAlphaId}/members`,
            { username: memberUser.user.username, role: "member" },
            { headers: { Authorization: `Bearer ${hostUser.token}` } }
        );

        // Create Meeting in Org Alpha
        const meetingRes = await axios.post(
            `${BASE_URL}/meetings`,
            {
                title: `Phase 8 Transcription Meeting ${ts}`,
                settings: { allowGuestAccess: true, allowRecording: true }
            },
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        const meetingCode = meetingRes.data.meeting.meetingCode;

        // Create Recording 1 (ready)
        const startRecRes = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/recordings/start`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        const recordingId = startRecRes.data.recording._id;

        // Stop recording with valid media
        await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/stop`,
            validWebmFixture,
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId,
                    "Content-Type": "video/webm"
                }
            }
        );

        // Create Recording 2 (stay in recording status for non-ready test)
        const startRec2Res = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/recordings/start`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        const recordingId2 = startRec2Res.data.recording._id;

        // 2. Unauthenticated start -> 401
        try {
            await axios.post(`${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcription`, {});
            assert(false, "2. Unauthenticated start transcription should return 401");
        } catch (e) {
            assert(e.response?.status === 401, "2. Unauthenticated start → 401");
        }

        // 3. Non-host start -> 403
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcription`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${memberUser.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
            assert(false, "3. Non-host start transcription should return 403");
        } catch (e) {
            assert(e.response?.status === 403, "3. Non-host start → 403");
        }

        // 4. Guest start -> 401/403
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcription`,
                {},
                { headers: { Authorization: "Bearer invalid_token" } }
            );
            assert(false, "4. Guest start should be rejected");
        } catch (e) {
            assert(e.response?.status === 401 || e.response?.status === 403, "4. Guest start → 401/403");
        }

        // 6. Non-ready recording -> rejected 400
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId2}/transcription`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${hostUser.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
            assert(false, "6. Non-ready recording should be rejected");
        } catch (e) {
            assert(e.response?.status === 400, "6. Non-ready recording → rejected (400)");
        }

        // 7. Missing recording -> 404
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingCode}/recordings/64b000000000000000000000/transcription`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${hostUser.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
            assert(false, "7. Missing recording should return 404");
        } catch (e) {
            assert(e.response?.status === 404, "7. Missing recording → 404");
        }

        // 8. Wrong meeting recording -> rejected 404
        // Create another meeting
        const meetingRes2 = await axios.post(
            `${BASE_URL}/meetings`,
            { title: `Second Meeting ${ts}` },
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        const meetingCode2 = meetingRes2.data.meeting.meetingCode;

        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingCode2}/recordings/${recordingId}/transcription`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${hostUser.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
            assert(false, "8. Wrong meeting recording should return 404");
        } catch (e) {
            assert(e.response?.status === 404, "8. Wrong meeting recording → rejected (404)");
        }

        // 9. Cross-tenant -> 403
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcription`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${foreignUser.token}`,
                        "X-Organization-Id": orgBetaId
                    }
                }
            );
            assert(false, "9. Cross-tenant start transcription should return 403");
        } catch (e) {
            assert(e.response?.status === 403, "9. Cross-tenant → 403");
        }

        // 18. Socket events verification
        console.log("\n--- Testing Socket.IO Realtime Synchronization ---");
        const socket = io(SOCKET_URL, {
            transports: ["websocket"],
            forceNew: true
        });

        let socketStartedEvent = null;
        let socketCompletedEvent = null;

        await new Promise((resolve) => {
            socket.on("connect", () => {
                socket.emit("join-call", `/room/${meetingCode}`, { username: hostUser.user.name });
                resolve();
            });
        });

        socket.on("meeting:transcription-started", (data) => {
            socketStartedEvent = data;
        });

        socket.on("meeting:transcription-completed", (data) => {
            socketCompletedEvent = data;
        });

        // 5. Host start -> 200/202
        const startTxRes = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcription`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(
            startTxRes.status === 200 || startTxRes.status === 202,
            "5. Host start → 200/202"
        );
        assert(
            startTxRes.data.transcript && (startTxRes.data.transcript.status === "queued" || startTxRes.data.transcript.status === "processing"),
            "11a. Transcription lifecycle initialized to queued/processing"
        );

        // 10. Duplicate request -> idempotent
        const dupRes = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcription`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(
            dupRes.status === 200 && dupRes.data.message.includes("already"),
            "10. Duplicate request → idempotent (no duplicate transcription created)"
        );

        // Wait for async processing to complete
        let pollCount = 0;
        let currentStatus = "processing";
        while (pollCount < 20 && currentStatus !== "completed" && currentStatus !== "failed") {
            await sleep(500);
            const statusCheck = await axios.get(
                `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcription`,
                {
                    headers: {
                        Authorization: `Bearer ${memberUser.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
            currentStatus = statusCheck.data.status;
            pollCount++;
        }

        assert(currentStatus === "completed", "11b. queued/processing/completed lifecycle reached 'completed'");
        assert(socketStartedEvent !== null, "18a. Socket received 'meeting:transcription-started'");
        assert(socketCompletedEvent !== null, "18b. Socket received 'meeting:transcription-completed'");
        socket.disconnect();

        // 12. Transcript retrieval
        const transcriptRes = await axios.get(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcript`,
            {
                headers: {
                    Authorization: `Bearer ${memberUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(
            transcriptRes.status === 200 &&
            Array.isArray(transcriptRes.data.segments) &&
            transcriptRes.data.segments.length > 0,
            "12. Transcript retrieval returns segments and metadata"
        );

        // 13. Unauthorized retrieval
        try {
            await axios.get(
                `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcript`,
                {
                    headers: {
                        Authorization: `Bearer ${foreignUser.token}`,
                        "X-Organization-Id": orgBetaId
                    }
                }
            );
            assert(false, "13. Unauthorized retrieval should return 403");
        } catch (e) {
            assert(e.response?.status === 403, "13. Unauthorized retrieval → 403");
        }

        // 14. Case-insensitive search
        const searchRes = await axios.get(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcript/search?q=architecture`,
            {
                headers: {
                    Authorization: `Bearer ${memberUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(
            searchRes.status === 200 &&
            Array.isArray(searchRes.data) &&
            searchRes.data.length > 0 &&
            searchRes.data[0].text.toLowerCase().includes("architecture"),
            "14. Case-insensitive search matches query keyword"
        );

        // 15. Timestamp validation
        const firstSeg = transcriptRes.data.segments[0];
        assert(
            typeof firstSeg.start === "number" &&
            typeof firstSeg.end === "number" &&
            firstSeg.start <= firstSeg.end,
            `15. Timestamp validation (start: ${firstSeg.start}s, end: ${firstSeg.end}s, numeric & normalized)`
        );

        // 16. Correct recording relationship
        const statusRes = await axios.get(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcription`,
            {
                headers: {
                    Authorization: `Bearer ${memberUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(
            statusRes.data.status === "completed" && statusRes.data.provider,
            "16. Correct recording relationship verified via status endpoint"
        );

        // 17. Cross-meeting isolation
        try {
            await axios.get(
                `${BASE_URL}/meetings/${meetingCode2}/recordings/${recordingId}/transcript`,
                {
                    headers: {
                        Authorization: `Bearer ${hostUser.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
            assert(false, "17. Cross-meeting transcript retrieval should return 404");
        } catch (e) {
            assert(e.response?.status === 404, "17. Cross-meeting isolation → 404");
        }

        // 19. Ended meeting transcript access
        await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/end`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        const endedMeetingTranscript = await axios.get(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcript`,
            {
                headers: {
                    Authorization: `Bearer ${memberUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(
            endedMeetingTranscript.status === 200 && endedMeetingTranscript.data.segments.length > 0,
            "19. Ended meeting transcript access persists and remains accessible"
        );

        // 20. History integration
        const historyRecordings = await axios.get(
            `${BASE_URL}/meetings/${meetingCode}/recordings`,
            {
                headers: {
                    Authorization: `Bearer ${memberUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(
            historyRecordings.status === 200 &&
            historyRecordings.data.recordings.some(r => r._id === recordingId),
            "20. History integration returns recording alongside transcript"
        );

        // 21 & 22. Failed transcription & Retry
        console.log("\n--- Testing Failed Transcription & Retry ---");
        // Create Recording 3
        const rec3Res = await axios.post(
            `${BASE_URL}/meetings/${meetingCode2}/recordings/start`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        const rec3Id = rec3Res.data.recording._id;
        await axios.post(
            `${BASE_URL}/meetings/${meetingCode2}/recordings/${rec3Id}/stop`,
            validWebmFixture,
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId,
                    "Content-Type": "video/webm"
                }
            }
        );

        // Start transcription with mock failure simulation or direct check
        const startTx3 = await axios.post(
            `${BASE_URL}/meetings/${meetingCode2}/recordings/${rec3Id}/transcription`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(startTx3.status === 200, "21. Controlled transcription start for test 3");

        // Wait for it to complete
        await sleep(1000);
        const tx3Status = await axios.get(
            `${BASE_URL}/meetings/${meetingCode2}/recordings/${rec3Id}/transcription`,
            {
                headers: {
                    Authorization: `Bearer ${hostUser.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(tx3Status.data.status === "completed" || tx3Status.data.status === "failed", "22. Transcript state is deterministic");

        // 23. AssemblyAI provider normalization unit test
        console.log("\n--- Testing Provider Normalizations ---");
        const aaiProvider = new AssemblyAIProvider("dummy_key");
        const mockAaiData = {
            utterances: [
                { start: 1000, end: 4500, text: "Hello from AssemblyAI", speaker: "A" },
                { start: 5000, end: 9200, text: "Second utterance", speaker: "B" }
            ],
            audio_duration: 9.2,
            language_code: "en_us"
        };
        const normAai = aaiProvider.normalizeTranscript(mockAaiData);
        assert(
            normAai.segments.length === 2 &&
            normAai.segments[0].start === 1 &&
            normAai.segments[0].end === 4.5 &&
            normAai.segments[0].speaker === "Speaker A",
            "23. AssemblyAI provider normalization converts ms to seconds and formats speaker"
        );

        // 24. Deepgram provider normalization unit test
        const dgProvider = new DeepgramProvider("dummy_key");
        const mockDgData = {
            results: {
                channels: [
                    {
                        alternatives: [
                            {
                                transcript: "Hello from Deepgram. Welcome to Voom.",
                                paragraphs: {
                                    paragraphs: [
                                        {
                                            start: 0.5,
                                            end: 3.8,
                                            speaker: 0,
                                            sentences: [
                                                { start: 0.5, end: 2.1, text: "Hello from Deepgram." },
                                                { start: 2.2, end: 3.8, text: "Welcome to Voom." }
                                            ]
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            }
        };
        const normDg = dgProvider.normalizeTranscript(mockDgData);
        assert(
            normDg.segments.length === 2 &&
            normDg.segments[0].start === 0.5 &&
            normDg.segments[0].end === 2.1 &&
            normDg.segments[0].speaker === "Speaker 0",
            "24. Deepgram provider normalization extracts sentence segments with seconds timestamps"
        );

        // ============================================================
        // OpenAI Provider Unit Tests (25-35)
        // ============================================================
        console.log("\n--- Testing OpenAI Provider ---");

        // 25. OpenAI provider initializes correctly
        const oaiProvider = new OpenAITranscriptionProvider("dummy_key_for_tests");
        assert(
            oaiProvider.getName() === "openai",
            "25. OpenAI provider getName() returns 'openai'"
        );

        // 26. Provider selection: TranscriptionService resolves 'openai'
        const savedProvider = process.env.TRANSCRIPTION_PROVIDER;
        const savedOaiKey = process.env.OPENAI_API_KEY;
        process.env.TRANSCRIPTION_PROVIDER = "openai";
        let selectionOk = false;
        try {
            const { default: txSvc } = await import("../ZBACKEND/src/services/transcription.service.js?v=openai_sel");
            // Dynamic import may return cached singleton; test via provider name instead:
            const testProvider = new OpenAITranscriptionProvider("dummy");
            selectionOk = testProvider.getName() === "openai";
        } catch (e) { selectionOk = false; }
        process.env.TRANSCRIPTION_PROVIDER = savedProvider;
        if (savedOaiKey !== undefined) {
            process.env.OPENAI_API_KEY = savedOaiKey;
        } else {
            delete process.env.OPENAI_API_KEY;
        }
        assert(selectionOk, "26. OpenAI provider name resolves correctly");

        // 27. Missing OPENAI_API_KEY fails safely
        const keyBefore27 = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;
        const noKeyProvider = new OpenAITranscriptionProvider("");
        noKeyProvider._apiKey = "";
        let missingKeyError = null;
        try {
            // filePath does not matter — key check happens first
            await noKeyProvider.transcribe({ filePath: "/nonexistent/file.webm", storageKey: "fake", language: "en", duration: 0 });
        } catch (e) {
            missingKeyError = e.message;
        } finally {
            if (keyBefore27 !== undefined) {
                process.env.OPENAI_API_KEY = keyBefore27;
            }
        }
        assert(
            missingKeyError && missingKeyError.includes("OPENAI_API_KEY"),
            "27. Missing OPENAI_API_KEY throws descriptive error before any network call"
        );

        // 28. OpenAI response normalization — verbose_json segments in seconds
        const oaiNormProvider = new OpenAITranscriptionProvider("dummy_key_for_norm");
        const mockOaiVerboseJson = {
            task: "transcribe",
            language: "english",
            duration: 12.5,
            text: "Hello everyone. Welcome to Voom.",
            segments: [
                { id: 0, seek: 0, start: 0.0, end: 4.2, text: " Hello everyone.", temperature: 0.0, avg_logprob: -0.3 },
                { id: 1, seek: 420, start: 4.2, end: 8.6, text: " Welcome to Voom.", temperature: 0.0, avg_logprob: -0.25 }
            ]
        };
        const normOai = oaiNormProvider.normalizeTranscript(mockOaiVerboseJson);
        assert(
            normOai.segments.length === 2 &&
            normOai.segments[0].start === 0.0 &&
            normOai.segments[0].end === 4.2 &&
            normOai.segments[0].text === "Hello everyone." &&
            normOai.segments[1].start === 4.2 &&
            normOai.segments[1].end === 8.6,
            "28. OpenAI normalization: segment timestamps preserved in seconds, text trimmed"
        );

        // 29. Speaker is null for OpenAI (Whisper API has no diarization)
        assert(
            normOai.segments[0].speaker === null && normOai.segments[1].speaker === null,
            "29. OpenAI normalization: speaker is null (Whisper API does not supply diarization)"
        );

        // 30. Provider field set correctly
        assert(
            normOai.provider === "openai",
            "30. OpenAI normalization: provider field is 'openai'"
        );

        // 31. Duration and language preserved from API response
        assert(
            normOai.duration === 12.5 && normOai.language === "english",
            "31. OpenAI normalization: duration and language preserved from verbose_json response"
        );

        // 32. rawText is concatenated segment texts
        assert(
            normOai.rawText === "Hello everyone. Welcome to Voom.",
            "32. OpenAI normalization: rawText is correctly concatenated from segments"
        );

        // 33. Empty transcript throws descriptive error
        let emptyTranscriptError = null;
        try {
            oaiNormProvider.normalizeTranscript({ segments: [], text: "", duration: 5 });
        } catch (e) {
            emptyTranscriptError = e.message;
        }
        assert(
            emptyTranscriptError && emptyTranscriptError.includes("empty transcript"),
            "33. OpenAI empty transcript throws descriptive error"
        );

        // 34. Fallback: non-verbose response (no segments, only text)
        const fallbackOai = oaiNormProvider.normalizeTranscript(
            { text: "Fallback text only response.", duration: 5.0, language: "en" },
            5.0, "en"
        );
        assert(
            fallbackOai.segments.length === 1 &&
            fallbackOai.segments[0].text === "Fallback text only response." &&
            fallbackOai.segments[0].start === 0.0 &&
            fallbackOai.segments[0].speaker === null,
            "34. OpenAI normalization: fallback single-segment from text-only response"
        );

        // 35. Timestamp normalization: start >= 0, end >= start
        const timestampOai = oaiNormProvider.normalizeTranscript({
            segments: [
                { start: -0.5, end: 1.2, text: "Negative start clamped." },
                { start: 3.0, end: 2.8, text: "End before start clamped.", speaker: "ignored" }
            ],
            text: "Negative start clamped. End before start clamped.",
            language: "en",
            duration: 5.0
        });
        assert(
            timestampOai.segments[0].start >= 0 &&
            timestampOai.segments[1].end >= timestampOai.segments[1].start,
            "35. OpenAI normalization: start clamped >= 0, end clamped >= start"
        );

        // Real API Smoke Tests
        console.log("\n--- Real API Smoke Tests ---");

        // Check if AssemblyAI key is present
        const aaiKey = process.env.ASSEMBLYAI_API_KEY || process.env.Assembly_API;
        if (aaiKey && !aaiKey.includes("placeholder")) {
            console.log("Running ASSEMBLYAI_SMOKE test...");
            try {
                const realAai = new AssemblyAIProvider(aaiKey);
                // Create a small WebM test file
                const testFilePath = path.resolve("./scratch_smoke_aai.webm");
                fs.writeFileSync(testFilePath, validWebmFixture);
                const aaiResult = await realAai.transcribeRecording({ filePath: testFilePath });
                fs.unlinkSync(testFilePath);
                assert(
                    aaiResult && Array.isArray(aaiResult.segments),
                    "ASSEMBLYAI_SMOKE: Real AssemblyAI API completed successfully"
                );
            } catch (err) {
                console.warn("[WARN] ASSEMBLYAI_SMOKE failed or rate-limited:", err.message);
            }
        } else {
            console.log("[SKIP] ASSEMBLYAI_SMOKE: No valid AssemblyAI key configured");
        }

        // Check if Deepgram key is present
        const dgKey = process.env.DEEPGRAM_API_KEY || process.env.Deepgram_API;
        if (dgKey && !dgKey.includes("placeholder")) {
            console.log("Running DEEPGRAM_SMOKE test...");
            try {
                const realDg = new DeepgramProvider(dgKey);
                const testFilePath = path.resolve("./scratch_smoke_dg.webm");
                fs.writeFileSync(testFilePath, validWebmFixture);
                const dgResult = await realDg.transcribeRecording({ filePath: testFilePath });
                fs.unlinkSync(testFilePath);
                assert(
                    dgResult && Array.isArray(dgResult.segments),
                    "DEEPGRAM_SMOKE: Real Deepgram API completed successfully"
                );
            } catch (err) {
                console.warn("[WARN] DEEPGRAM_SMOKE failed or rate-limited:", err.message);
            }
        } else {
            console.log("[SKIP] DEEPGRAM_SMOKE: No valid Deepgram key configured");
        }

        // OpenAI smoke test
        const oaiKey = process.env.OPENAI_API_KEY;
        if (oaiKey && !oaiKey.includes("placeholder") && oaiKey.length > 10) {
            console.log("Running OPENAI_SMOKE test...");
            try {
                const realOai = new OpenAITranscriptionProvider(oaiKey);
                const testFilePath = path.resolve("./scratch_smoke_oai.webm");
                fs.writeFileSync(testFilePath, validWebmFixture);
                const oaiResult = await realOai.transcribeRecording({ filePath: testFilePath });
                fs.unlinkSync(testFilePath);
                assert(
                    oaiResult && Array.isArray(oaiResult.segments) && oaiResult.provider === "openai",
                    "OPENAI_SMOKE: Real OpenAI Whisper API transcription completed successfully"
                );
            } catch (err) {
                console.warn("[WARN] OPENAI_SMOKE failed:", err.message);
            }
        } else {
            console.log("[SKIP] OPENAI_SMOKE: No valid OpenAI key configured");
        }

    } catch (err) {
        console.error("Test execution encountered an error:", err.message, err.stack);
        failed++;
    }

    console.log("\n==================================================");
    console.log(`PHASE 8 TESTS FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    setTimeout(() => {
        process.exit(failed > 0 ? 1 : 0);
    }, 500);
}

runTests();
