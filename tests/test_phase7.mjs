import axios from "axios";
import { io } from "socket.io-client";
import fs from "fs";
import path from "path";

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

async function runTests() {
    console.log("=== STARTING PHASE 7 AUTOMATED TEST SUITE ===");

    try {
        // 1. Health endpoint
        const health = await axios.get(`${BASE_URL}/health`);
        assert(health.status === 200 && health.data.status === "ok", "1. Health endpoint responds 200 OK");

        const ts = Date.now();

        // Helper to register and login
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
        const userA = await registerAndLogin(`p7_host_${ts}`, "Pass123!@#", "Phase7 Host");
        const userB = await registerAndLogin(`p7_member_${ts}`, "Pass123!@#", "Phase7 Member");
        const userC = await registerAndLogin(`p7_beta_${ts}`, "Pass123!@#", "Phase7 BetaUser");

        // User A creates Org Alpha
        const orgAlphaRes = await axios.post(
            `${BASE_URL}/organizations`,
            { name: `Alpha_P7_${ts}` },
            { headers: { Authorization: `Bearer ${userA.token}` } }
        );
        const orgAlphaId = orgAlphaRes.data.organization._id || orgAlphaRes.data.organization.id;

        // User C creates Org Beta
        const orgBetaRes = await axios.post(
            `${BASE_URL}/organizations`,
            { name: `Beta_P7_${ts}` },
            { headers: { Authorization: `Bearer ${userC.token}` } }
        );
        const orgBetaId = orgBetaRes.data.organization._id || orgBetaRes.data.organization.id;

        // Add User B to Org Alpha as regular member
        await axios.post(
            `${BASE_URL}/organizations/${orgAlphaId}/members`,
            { username: userB.user.username, role: "member" },
            { headers: { Authorization: `Bearer ${userA.token}` } }
        );

        // Create Meeting in Org Alpha
        const meetingRes = await axios.post(
            `${BASE_URL}/meetings`,
            {
                title: `Phase 7 Recording Meeting ${ts}`,
                settings: { allowGuestAccess: true, allowRecording: true }
            },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(meetingRes.status === 201, "Meeting in Org Alpha created with 201 Created");
        const meetingCode = meetingRes.data.meeting.meetingCode;

        // ==========================================
        // AUTHORIZATION TESTS
        // ==========================================
        console.log("\n--- Testing Recording Authorization ---");

        // 2. Unauthenticated recording start -> 401
        try {
            await axios.post(`${BASE_URL}/meetings/${meetingCode}/recordings/start`);
            assert(false, "2. Unauthenticated recording start rejected with 401");
        } catch (err) {
            assert(err.response?.status === 401, "2. Unauthenticated recording start rejected with 401");
        }

        // 3. Non-host member recording start -> 403
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingCode}/recordings/start`,
                {},
                { headers: { Authorization: `Bearer ${userB.token}`, "X-Organization-Id": orgAlphaId } }
            );
            assert(false, "3. Non-host member recording start rejected with 403");
        } catch (err) {
            assert(err.response?.status === 403, "3. Non-host member recording start rejected with 403");
        }

        // 4. Guest recording start -> 401/403
        try {
            await axios.post(`${BASE_URL}/meetings/${meetingCode}/recordings/start`);
            assert(false, "4. Guest recording start rejected");
        } catch (err) {
            assert(err.response?.status === 401 || err.response?.status === 403, "4. Guest recording start rejected with 401/403");
        }

        // 5. Host recording start -> 200/201
        const startRes = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/recordings/start`,
            {},
            { headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId } }
        );
        assert(startRes.status === 201 || startRes.status === 200, "5. Host recording start succeeds with 200/201");
        const recordingId = startRes.data.recording._id;

        // ==========================================
        // RECORDING LIFECYCLE TESTS
        // ==========================================
        console.log("\n--- Testing Recording Lifecycle ---");

        // 6. Start recording status = recording
        assert(startRes.data.recording.status === "recording", "6. Active recording has status 'recording'");

        // 7. Active recording retrieval
        const listRes = await axios.get(`${BASE_URL}/meetings/${meetingCode}/recordings`, {
            headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
        });
        const activeInList = listRes.data.recordings.find(r => r._id === recordingId);
        assert(Boolean(activeInList) && activeInList._id === recordingId, "7. Active recording retrieval returns recording ID");

        // 8. Stop with valid WebM media fixture -> status = ready
        // We upload validWebmFixture binary buffer
        const stopRes = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/stop`,
            validWebmFixture,
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId,
                    "Content-Type": "video/webm"
                }
            }
        );
        assert(stopRes.status === 200, "8. Stop recording with WebM media succeeds with 200 OK");
        assert(stopRes.data.recording.status === "ready", "8. Recording status updated to 'ready'");

        // 9. Duration populated
        assert(stopRes.data.recording.duration >= 0, "9. Recording duration is populated");

        // 10. File size populated
        assert(stopRes.data.recording.fileSize === validWebmFixture.length, `10. File size populated correctly (${stopRes.data.recording.fileSize} bytes)`);

        // 11. storageKey populated
        assert(Boolean(stopRes.data.recording.storageKey) && stopRes.data.recording.storageKey.startsWith("recording_"), "11. Safe storageKey populated on recording");

        // ==========================================
        // MEDIA STREAMING TESTS
        // ==========================================
        console.log("\n--- Testing Media Streaming & Byte-Range Handling ---");

        // 12. Media endpoint (200 OK or 206)
        const mediaRes = await axios.get(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/media`,
            {
                headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId },
                responseType: "arraybuffer"
            }
        );
        assert(mediaRes.status === 200, "12. Media endpoint returns 200 OK for full request");

        // 13. Content-Type is video/webm
        assert(mediaRes.headers["content-type"]?.includes("video/webm"), "13. Content-Type header is video/webm");

        // 14. Range request -> 206 Partial Content
        const rangeRes = await axios.get(
            `${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/media`,
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId,
                    Range: "bytes=0-100"
                },
                responseType: "arraybuffer"
            }
        );
        assert(rangeRes.status === 206, "14. Range request returns 206 Partial Content");

        // 15. Content-Range exists
        assert(Boolean(rangeRes.headers["content-range"]) && rangeRes.headers["content-range"].startsWith("bytes 0-100/"), "15. Content-Range header matches requested range");

        // 16. Accept-Ranges exists
        assert(rangeRes.headers["accept-ranges"] === "bytes", "16. Accept-Ranges header specifies 'bytes'");

        // ==========================================
        // TENANT ISOLATION TESTS
        // ==========================================
        console.log("\n--- Testing Tenant Isolation ---");

        // 17. Cross-tenant recording retrieval -> 403
        try {
            await axios.get(`${BASE_URL}/meetings/${meetingCode}/recordings`, {
                headers: { Authorization: `Bearer ${userC.token}`, "X-Organization-Id": orgBetaId }
            });
            assert(false, "17. Cross-tenant recording retrieval rejected with 403");
        } catch (err) {
            assert(err.response?.status === 403, "17. Cross-tenant recording retrieval rejected with 403");
        }

        // 18. Cross-tenant recording deletion -> 403
        try {
            await axios.delete(`${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}`, {
                headers: { Authorization: `Bearer ${userC.token}`, "X-Organization-Id": orgBetaId }
            });
            assert(false, "18. Cross-tenant recording deletion rejected with 403");
        } catch (err) {
            assert(err.response?.status === 403, "18. Cross-tenant recording deletion rejected with 403");
        }

        // ==========================================
        // CROSS-MEETING ISOLATION TESTS
        // ==========================================
        console.log("\n--- Testing Cross-Meeting Isolation ---");

        // Create Meeting B in Org Alpha
        const meetingBRes = await axios.post(
            `${BASE_URL}/meetings`,
            { title: `Meeting B ${ts}` },
            { headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId } }
        );
        const meetingCodeB = meetingBRes.data.meeting.meetingCode;

        // 19. Meeting A recording through Meeting B -> 404
        try {
            await axios.get(`${BASE_URL}/meetings/${meetingCodeB}/recordings/${recordingId}`, {
                headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
            });
            assert(false, "19. Meeting A recording accessed through Meeting B rejected");
        } catch (err) {
            assert(err.response?.status === 404, "19. Meeting A recording accessed through Meeting B returns 404 Not Found");
        }

        // ==========================================
        // DELETION TESTS
        // ==========================================
        console.log("\n--- Testing Recording Deletion ---");

        // 20. Non-host deletion -> 403
        try {
            await axios.delete(`${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}`, {
                headers: { Authorization: `Bearer ${userB.token}`, "X-Organization-Id": orgAlphaId }
            });
            assert(false, "20. Non-host deletion rejected with 403");
        } catch (err) {
            assert(err.response?.status === 403, "20. Non-host deletion rejected with 403");
        }

        // 21. Authorized deletion -> success
        const deleteRes = await axios.delete(`${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}`, {
            headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
        });
        assert(deleteRes.status === 200, "21. Authorized deletion succeeds with 200 OK");

        // 22. Physical file no longer accessible
        try {
            await axios.get(`${BASE_URL}/meetings/${meetingCode}/recordings/${recordingId}/media`, {
                headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
            });
            assert(false, "22. Deleted recording media should not be accessible");
        } catch (err) {
            assert(err.response?.status === 404, "22. Physical file / media no longer accessible (404)");
        }

        // ==========================================
        // SOCKET.IO RECORDING TESTS
        // ==========================================
        console.log("\n--- Testing Socket.IO Realtime Synchronization ---");

        const createSocket = (path, metadata) => {
            return new Promise((resolve) => {
                const socket = io(SOCKET_URL, { reconnection: false, forceNew: true, transports: ["websocket"] });
                const onConnect = () => {
                    socket.emit("join-call", path, metadata);
                    setTimeout(() => resolve(socket), 100);
                };
                if (socket.connected) {
                    onConnect();
                } else {
                    socket.on("connect", onConnect);
                }
            });
        };

        const socketHost = await createSocket(`/${meetingCode}`, {
            username: userA.user.username,
            userId: userA.user._id || userA.user.id,
            isHost: true
        });

        const socketPeer = await createSocket(`/${meetingCode}`, {
            username: userB.user.username,
            userId: userB.user._id || userB.user.id,
            isHost: false
        });

        // 23. Start event delivered to peers
        const startPromise = new Promise((resolve) => {
            socketPeer.on("meeting:recording-started", (data) => {
                resolve(data);
            });
        });

        socketHost.emit("meeting:recording-start", { meetingCode });
        const startSocketData = await startPromise;
        assert(Boolean(startSocketData?.recordingId), "23. Socket.IO meeting:recording-started delivered to peer");

        const socketRecordingId = startSocketData.recordingId;

        // 24. Stop event delivered to peers
        const stopPromise = new Promise((resolve) => {
            socketPeer.on("meeting:recording-stopped", (data) => {
                resolve(data);
            });
        });

        socketHost.emit("meeting:recording-stop", { meetingCode, recordingId: socketRecordingId });
        const stopSocketData = await stopPromise;
        assert(Boolean(stopSocketData?.recordingId), "24. Socket.IO meeting:recording-stopped delivered to peer");

        // 25. Unauthorized start event rejected
        const errorPromise = new Promise((resolve) => {
            socketPeer.on("meeting:error", (data) => {
                resolve(data);
            });
        });

        socketPeer.emit("meeting:recording-start", { meetingCode });
        const errorData = await errorPromise;
        assert(Boolean(errorData?.message), "25. Unauthorized participant recording start rejected via socket");

        // 26. Cross-tenant socket event rejected
        const socketBeta = await createSocket(`/diff_${ts}`, {
            username: userC.user.username,
            userId: userC.user._id || userC.user.id,
            isHost: false
        });

        const crossTenantErrorPromise = new Promise((resolve) => {
            socketBeta.on("meeting:error", (data) => {
                resolve(data);
            });
        });

        socketBeta.emit("meeting:recording-start", { meetingCode });
        const crossTenantErr = await crossTenantErrorPromise;
        assert(Boolean(crossTenantErr), "26. Cross-tenant socket recording event rejected");

        socketHost.disconnect();
        socketPeer.disconnect();
        socketBeta.disconnect();

        // ==========================================
        // MEETING END FINALIZATION TESTS
        // ==========================================
        console.log("\n--- Testing Meeting End Recording Finalization ---");

        // Create new meeting for end test
        const endMeetingRes = await axios.post(
            `${BASE_URL}/meetings`,
            { title: `End Test Meeting ${ts}` },
            { headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId } }
        );
        const endMeetingCode = endMeetingRes.data.meeting.meetingCode;

        // Start recording
        const startEndRec = await axios.post(
            `${BASE_URL}/meetings/${endMeetingCode}/recordings/start`,
            {},
            { headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId } }
        );
        const endRecId = startEndRec.data.recording._id;

        // 27. End meeting while recording active -> safe finalization
        const endRes = await axios.post(
            `${BASE_URL}/meetings/${endMeetingCode}/end`,
            {},
            { headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId } }
        );
        assert(endRes.status === 200, "27. Active recording + meeting end safely finalized");

        // 28. Ended meeting recording metadata accessible
        const endedMeetingRecs = await axios.get(`${BASE_URL}/meetings/${endMeetingCode}/recordings`, {
            headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
        });
        assert(endedMeetingRecs.status === 200, "28. Ended meeting recordings accessible");
        const finalizedRec = endedMeetingRecs.data.recordings.find(r => r._id === endRecId);
        assert(finalizedRec && finalizedRec.status !== "recording", "28. Active recording status finalized upon meeting end");

        // 29. Meeting remains ended
        const checkMeeting = await axios.get(`${BASE_URL}/meetings/${endMeetingCode}`, {
            headers: { Authorization: `Bearer ${userA.token}` }
        });
        assert(checkMeeting.data.status === "ended", "29. Meeting remains in 'ended' status");

        // ==========================================
        // HISTORY INTEGRATION TESTS
        // ==========================================
        console.log("\n--- Testing History & Playback ---");

        // 30. View recordings for ended meeting
        assert(Array.isArray(endedMeetingRecs.data.recordings), "30. View recordings returns array for ended meeting");

        // 31. Playback / metadata retrieval does not restart meeting
        const checkMeetingAgain = await axios.get(`${BASE_URL}/meetings/${endMeetingCode}`, {
            headers: { Authorization: `Bearer ${userA.token}` }
        });
        assert(checkMeetingAgain.data.status === "ended", "31. Recording access does not restart meeting");

    } catch (err) {
        console.error("Test execution error:", err.message, err.response?.data);
        failed++;
    }

    console.log(`\n========================================`);
    console.log(`PHASE 7 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
