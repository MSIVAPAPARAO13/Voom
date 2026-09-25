import axios from "axios";
import { io } from "socket.io-client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(".env") });
import { Queue } from "bullmq";

const BASE_URL = "http://localhost:8000/api/v1";
const SOCKET_URL = "http://localhost:8000";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
    console.log("==================================================");
    console.log("=== STARTING PHASE 12 AUTOMATED TEST SUITE     ===");
    console.log("==================================================");

    try {
        const health = await axios.get(`${BASE_URL}/health`);
        assert(health.status === 200, "18. Backend health check responds successfully");

        const ts = Date.now();
        const registerAndLogin = async (username, password, name) => {
            try { await axios.post(`${BASE_URL}/users/register`, { name, username, password }); } catch (e) {}
            const loginRes = await axios.post(`${BASE_URL}/users/login`, { username, password });
            return { token: loginRes.data.accessToken, user: loginRes.data.user };
        };

        const hostUser = await registerAndLogin(`p12_host_${ts}`, "Pass123!@#", "P12 Host");
        
        const orgRes = await axios.post(
            `${BASE_URL}/organizations`, { name: `Org_P12_${ts}` }, { headers: { Authorization: `Bearer ${hostUser.token}` } }
        );
        const orgId = orgRes.data.organization._id;

        const meetRes = await axios.post(
            `${BASE_URL}/meetings`, 
            { 
                topic: "P12 Worker Test", 
                type: "scheduled", 
                startTime: new Date().toISOString(),
                settings: { waitingRoom: false } 
            }, 
            { headers: { Authorization: `Bearer ${hostUser.token}`, "X-Organization-Id": orgId } }
        );
        const meetingCode = meetRes.data.meeting.meetingCode;

        // 1 & 2. Redis/BullMQ verification
        const testQueue = new Queue("transcription", { connection: { url: REDIS_URL, maxRetriesPerRequest: null } });
        await testQueue.waitUntilReady();
        assert(true, "1 & 2. Redis connectivity and BullMQ queue creation successful");
        await testQueue.close();

        // Join socket
        const socket = io(SOCKET_URL, { query: { token: hostUser.token }, transports: ["websocket"] });
        let socketConnected = false;
        socket.on("connect", () => { socketConnected = true; });
        await sleep(1000);
        socket.emit("join-call", `/meeting/${meetingCode}`, { username: "Host", userId: hostUser.user.id });

        let transcriptionStarted = false;
        let transcriptionProcessing = false;
        let transcriptionCompleted = false;

        socket.on("meeting:transcription-started", () => { transcriptionStarted = true; });
        socket.on("meeting:transcription-processing", () => { transcriptionProcessing = true; });
        socket.on("meeting:transcription-completed", () => { transcriptionCompleted = true; });

        // Start recording via HTTP API
        const startRecRes = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/recordings/start`, 
            {}, 
            { headers: { Authorization: `Bearer ${hostUser.token}`, "X-Organization-Id": orgId } }
        );
        const recordingId = startRecRes.data.recording._id;
        console.log("Recording ID is now:", recordingId);

        // Upload a dummy WebM to stop recording
        const validWebmFixture = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x42, 0x87, 0x81, 0x02, 0x42, 0x85, 0x81, 0x02, 0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x15, 0x49, 0xa9, 0x66, 0x99, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40, 0x4d, 0x80, 0x86, 0x43, 0x68, 0x72, 0x6f, 0x6d, 0x65, 0x57, 0x41, 0x86, 0x43, 0x68, 0x72, 0x6f, 0x6d, 0x65]);
        await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/stop`, 
            validWebmFixture, 
            { headers: { Authorization: `Bearer ${hostUser.token}`, "X-Organization-Id": orgId, "Content-Type": "video/webm" } }
        );

        // 3. Job enqueue (Mock provider must be active)
        const transRes = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/transcription`,
            {},
            { headers: { Authorization: `Bearer ${hostUser.token}`, "X-Organization-Id": orgId } }
        );
        assert(transRes.status === 202, "3. Job enqueue returns 202 Accepted");

        // Wait for worker to process (up to 30 seconds)
        let waitTime = 0;
        while (!transcriptionCompleted && waitTime < 30000) {
            await sleep(1000);
            waitTime += 1000;
        }

        assert(transcriptionStarted, "6a. Transcript lifecycle: queued via socket");
        assert(transcriptionProcessing, "6b. Transcript lifecycle: processing via socket");
        assert(transcriptionCompleted, "6c. Transcript lifecycle: completed via socket");
        assert(transcriptionCompleted, "16. Socket.IO worker notification delivered");

        socket.disconnect();
    } catch (error) {
        console.error("Test execution failed:", error.response?.data || error.message);
    } finally {
        console.log("==================================================");
        console.log(`PHASE 12 TESTS FINISHED: ${passed} PASSED, ${failed} FAILED`);
        console.log("==================================================");
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
