import axios from "axios";
import { io } from "socket.io-client";

const BASE_URL = "http://localhost:8000/api/v1";
const SOCKET_URL = "http://localhost:8000";

async function runTests() {
    console.log("=== STARTING PHASE 4 AUTOMATED TEST SUITE ===");
    let passed = 0;
    let failed = 0;

    const assert = (condition, message) => {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passed++;
        } else {
            console.error(`[FAIL] ${message}`);
            failed++;
        }
    };

    try {
        // 1. Health Check
        const healthRes = await axios.get(`${BASE_URL}/health`);
        assert(healthRes.status === 200 && healthRes.data.status === "ok", "Health endpoint responds 200 OK");

        // Helper to register and login
        const registerAndLogin = async (username, password, name) => {
            try {
                await axios.post(`${BASE_URL}/users/register`, { name, username, password });
            } catch (e) {
                // User may already exist from previous test runs
            }
            const loginRes = await axios.post(`${BASE_URL}/users/login`, { username, password });
            return {
                token: loginRes.data.accessToken,
                user: loginRes.data.user
            };
        };

        const ts = Date.now();
        console.log("\n--- Creating Test Users & Organizations ---");
        const userA = await registerAndLogin(`p4_host_${ts}`, "Pass123!@#", "Phase4 Host");
        const userB = await registerAndLogin(`p4_other_${ts}`, "Pass123!@#", "Phase4 OtherOrg");
        const userC = await registerAndLogin(`p4_member_${ts}`, "Pass123!@#", "Phase4 Member");

        // User A creates Org Alpha
        const orgAlphaRes = await axios.post(
            `${BASE_URL}/organizations`,
            { name: `Alpha_${ts}` },
            { headers: { Authorization: `Bearer ${userA.token}` } }
        );
        const orgAlphaId = orgAlphaRes.data.organization._id || orgAlphaRes.data.organization.id;

        // User B creates Org Beta
        const orgBetaRes = await axios.post(
            `${BASE_URL}/organizations`,
            { name: `Beta_${ts}` },
            { headers: { Authorization: `Bearer ${userB.token}` } }
        );
        const orgBetaId = orgBetaRes.data.organization._id || orgBetaRes.data.organization.id;

        // User A adds User C to Org Alpha as member
        await axios.post(
            `${BASE_URL}/organizations/${orgAlphaId}/members`,
            { username: userC.user.username, role: "member" },
            { headers: { Authorization: `Bearer ${userA.token}` } }
        );


        console.log("\n--- Testing Meeting Creation ---");
        // User A creates instant meeting with custom settings in Org Alpha
        const meetingRes1 = await axios.post(
            `${BASE_URL}/meetings`,
            {
                title: "Sprint Planning",
                description: "Review backlog and tasks",
                settings: {
                    allowGuestAccess: true,
                    waitingRoomEnabled: true,
                    allowChat: true,
                    allowScreenShare: true,
                    allowParticipantUnmute: true
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(meetingRes1.status === 201, "Meeting created with 201 Created");
        const meeting1 = meetingRes1.data.meeting;
        assert(meeting1.title === "Sprint Planning", "Meeting title persisted correctly");
        assert(meeting1.settings.waitingRoomEnabled === true, "Meeting setting waitingRoomEnabled persisted");
        assert(meeting1.status === "live", "Instant meeting status is 'live'");

        console.log("\n--- Testing Meeting Details & Guest Access ---");
        // Details fetched by Host (User A)
        const detailsHost = await axios.get(`${BASE_URL}/meetings/${meeting1.meetingCode}`, {
            headers: { Authorization: `Bearer ${userA.token}` }
        });
        assert(detailsHost.status === 200, "Host gets meeting details 200 OK");
        assert(detailsHost.data.isHost === true, "Host correctly identified with isHost=true");

        // Details fetched by Member (User C)
        const detailsMember = await axios.get(`${BASE_URL}/meetings/${meeting1.meetingCode}`, {
            headers: { Authorization: `Bearer ${userC.token}` }
        });
        assert(detailsMember.status === 200, "Member gets meeting details 200 OK");
        assert(detailsMember.data.isHost === false, "Member correctly identified with isHost=false");

        // Details fetched by Unauthenticated Guest (allowed since allowGuestAccess=true)
        const detailsGuest = await axios.get(`${BASE_URL}/meetings/${meeting1.meetingCode}`);
        assert(detailsGuest.status === 200, "Guest gets meeting details when allowGuestAccess=true");
        assert(detailsGuest.data.isHost === false, "Guest has isHost=false");

        console.log("\n--- Testing Host Authorization & Settings Updates ---");
        // Host (User A) updates meeting settings
        const updateSettingsRes = await axios.patch(
            `${BASE_URL}/meetings/${meeting1.meetingCode}/settings`,
            {
                title: "Sprint Planning - Updated",
                settings: {
                    allowChat: false
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(updateSettingsRes.status === 200, "Host can update meeting settings");
        assert(updateSettingsRes.data.meeting.settings.allowChat === false, "allowChat setting updated to false");

        // Non-host member (User C) attempts to update settings -> should be 403 Forbidden
        let memberUpdateBlocked = false;
        try {
            await axios.patch(
                `${BASE_URL}/meetings/${meeting1.meetingCode}/settings`,
                { title: "Hacked Title" },
                {
                    headers: {
                        Authorization: `Bearer ${userC.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
        } catch (e) {
            if (e.response && e.response.status === 403) memberUpdateBlocked = true;
        }
        assert(memberUpdateBlocked, "Non-host member update rejected with 403 Forbidden");

        // Unauthenticated guest attempts to update settings -> 401 Unauthorized
        let guestUpdateBlocked = false;
        try {
            await axios.patch(`${BASE_URL}/meetings/${meeting1.meetingCode}/settings`, { title: "Guest Title" });
        } catch (e) {
            if (e.response && e.response.status === 401) guestUpdateBlocked = true;
        }
        assert(guestUpdateBlocked, "Guest update rejected with 401 Unauthorized");

        console.log("\n--- Testing Tenant Isolation on Meetings ---");
        // User B (from Org Beta) attempts to update settings for Org Alpha's meeting -> 403 Forbidden
        let crossTenantUpdateBlocked = false;
        try {
            await axios.patch(
                `${BASE_URL}/meetings/${meeting1.meetingCode}/settings`,
                { title: "Cross Tenant Hack" },
                {
                    headers: {
                        Authorization: `Bearer ${userB.token}`,
                        "X-Organization-Id": orgBetaId
                    }
                }
            );
        } catch (e) {
            if (e.response && e.response.status === 403) crossTenantUpdateBlocked = true;
        }
        assert(crossTenantUpdateBlocked, "Cross-tenant settings update rejected with 403 Forbidden");

        // User B attempts to end Org Alpha's meeting -> 403 Forbidden
        let crossTenantEndBlocked = false;
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meeting1.meetingCode}/end`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${userB.token}`,
                        "X-Organization-Id": orgBetaId
                    }
                }
            );
        } catch (e) {
            if (e.response && e.response.status === 403) crossTenantEndBlocked = true;
        }
        assert(crossTenantEndBlocked, "Cross-tenant end meeting rejected with 403 Forbidden");

        console.log("\n--- Testing Guest Restriction (allowGuestAccess = false) ---");
        // Create meeting with allowGuestAccess = false
        const privateMeetingRes = await axios.post(
            `${BASE_URL}/meetings`,
            {
                title: "Strictly Private Org Meeting",
                settings: {
                    allowGuestAccess: false
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        const privateMeetingCode = privateMeetingRes.data.meeting.meetingCode;

        // Guest attempts to fetch details -> 403 Forbidden
        let guestPrivateBlocked = false;
        try {
            await axios.get(`${BASE_URL}/meetings/${privateMeetingCode}`);
        } catch (e) {
            if (e.response && e.response.status === 403) guestPrivateBlocked = true;
        }
        assert(guestPrivateBlocked, "Guest access rejected when allowGuestAccess=false (403 Forbidden)");

        console.log("\n--- Testing Ending Meeting ---");
        // Non-host member attempts to end meeting -> 403
        let memberEndBlocked = false;
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meeting1.meetingCode}/end`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${userC.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
        } catch (e) {
            if (e.response && e.response.status === 403) memberEndBlocked = true;
        }
        assert(memberEndBlocked, "Non-host member cannot end meeting (403 Forbidden)");

        // Host ends meeting -> 200 OK
        const endRes = await axios.post(
            `${BASE_URL}/meetings/${meeting1.meetingCode}/end`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(endRes.status === 200 && endRes.data.status === "ended", "Host ends meeting (200 OK, status: ended)");

        // Details now show status = "ended"
        const detailsEnded = await axios.get(`${BASE_URL}/meetings/${meeting1.meetingCode}`);
        assert(detailsEnded.data.status === "ended", "Meeting status verified as 'ended' in database");

        console.log("\n--- Testing Socket.IO Real-time Moderation & Contracts ---");
        // Create a new meeting for Socket.IO tests
        const socketMeetingRes = await axios.post(
            `${BASE_URL}/meetings`,
            {
                title: "Socket IO Test Meeting",
                settings: {
                    allowGuestAccess: true,
                    waitingRoomEnabled: false,
                    allowChat: true,
                    allowScreenShare: true
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        const socketMeetingCode = socketMeetingRes.data.meeting.meetingCode;

        // Connect Host socket
        const hostSocket = io(SOCKET_URL, { 
            transports: ["websocket"],
            auth: { token: userA.token }
        });
        // Connect Member socket
        const memberSocket = io(SOCKET_URL, { 
            transports: ["websocket"],
            auth: { token: userC.token }
        });

        let hostJoined = false;
        let memberJoined = false;
        let memberMutedReceived = false;
        let memberChatReceived = false;

        await new Promise((resolve) => {
            let joinedCount = 0;
            const onJoined = () => {
                joinedCount++;
                if (joinedCount === 2) resolve();
            };

            hostSocket.on("connect", () => {
                hostSocket.emit("join-call", `/${socketMeetingCode}`, {
                    username: "HostUser",
                    userId: userA.user.id,
                    isHost: true
                });
                hostJoined = true;
            });

            memberSocket.on("connect", () => {
                memberSocket.emit("join-call", `/${socketMeetingCode}`, {
                    username: "MemberUser",
                    userId: userC.user.id,
                    isHost: false
                });
                memberJoined = true;
            });

            hostSocket.on("user-joined", () => onJoined());
            memberSocket.on("user-joined", () => onJoined());
        });

        // Small sleep to ensure connections array updated
        await new Promise(r => setTimeout(r, 300));
        assert(hostJoined && memberJoined, "Both host and member connected and joined Socket.IO room");


        // Test Chat Broadcast
        await new Promise((resolve) => {
            hostSocket.on("chat-message", (data, sender) => {
                if (data === "Hello from member" && sender === "MemberUser") {
                    memberChatReceived = true;
                    resolve();
                }
            });
            memberSocket.emit("chat-message", "Hello from member", "MemberUser");
        });
        assert(memberChatReceived, "Chat message successfully broadcast between peers");

        // Test Host Muting Member
        await new Promise((resolve) => {
            memberSocket.on("meeting:participant-muted", () => {
                memberMutedReceived = true;
                resolve();
            });
            hostSocket.emit("meeting:mute-participant", {
                targetSocketId: memberSocket.id,
                meetingCode: socketMeetingCode
            });
        });
        assert(memberMutedReceived, "Target participant received 'meeting:participant-muted' event from host");

        // Disconnect sockets
        hostSocket.disconnect();
        memberSocket.disconnect();

        console.log(`\n=== TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error("Test execution failed with error:", err.message);
        if (err.response) {
            console.error("Response data:", err.response.data);
        }
        process.exit(1);
    }
}

runTests();
