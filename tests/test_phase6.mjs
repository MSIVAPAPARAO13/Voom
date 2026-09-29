import axios from "axios";
import { io } from "socket.io-client";

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

async function runTests() {
    console.log("=== STARTING PHASE 6 AUTOMATED TEST SUITE ===");

    try {
        // 1. Health check
        const health = await axios.get(`${BASE_URL}/health`);
        assert(health.status === 200 && health.data.status === "ok", "Health endpoint responds 200 OK");

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

        // 2. Setup Users & Orgs
        console.log("\n--- Creating Test Users & Organizations ---");
        const userA = await registerAndLogin(`p6_host_${ts}`, "Pass123!@#", "Phase6 Host");
        const userB = await registerAndLogin(`p6_member_${ts}`, "Pass123!@#", "Phase6 Member");
        const userC = await registerAndLogin(`p6_beta_${ts}`, "Pass123!@#", "Phase6 BetaUser");

        // User A creates Org Alpha
        const orgAlphaRes = await axios.post(
            `${BASE_URL}/organizations`,
            { name: `Alpha_P6_${ts}` },
            { headers: { Authorization: `Bearer ${userA.token}` } }
        );
        const orgAlphaId = orgAlphaRes.data.organization._id || orgAlphaRes.data.organization.id;

        // User C creates Org Beta
        const orgBetaRes = await axios.post(
            `${BASE_URL}/organizations`,
            { name: `Beta_P6_${ts}` },
            { headers: { Authorization: `Bearer ${userC.token}` } }
        );
        const orgBetaId = orgBetaRes.data.organization._id || orgBetaRes.data.organization.id;

        // Add User B to Org Alpha
        await axios.post(
            `${BASE_URL}/organizations/${orgAlphaId}/members`,
            { username: userB.user.username, role: "member" },
            { headers: { Authorization: `Bearer ${userA.token}` } }
        );

        // 3. Create Meeting in Org Alpha
        console.log("\n--- Creating Meeting in Org Alpha ---");
        const meetingRes = await axios.post(
            `${BASE_URL}/meetings`,
            {
                title: `Phase 6 Communication Meeting ${ts}`,
                settings: { allowGuestAccess: true, allowChat: true }
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

        // 4. Authenticated Chat Retrieval (Initial Empty)
        console.log("\n--- Testing Chat Message Retrieval & Sending ---");
        const initChat = await axios.get(`${BASE_URL}/meetings/${meetingCode}/messages`, {
            headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
        });
        assert(initChat.status === 200, "Authenticated chat retrieval returns 200 OK");
        assert(Array.isArray(initChat.data.messages) && initChat.data.messages.length === 0, "Initial chat messages list is empty");

        // 5. Send Message (User A)
        const sendResA = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/messages`,
            { message: "Hello from Host User A", senderName: "Phase6 Host" },
            { headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId } }
        );
        assert(sendResA.status === 201, "User A sends message (201 Created)");
        const messageAId = sendResA.data.chatMessage._id;
        assert(sendResA.data.chatMessage.message === "Hello from Host User A", "Message content saved correctly");
        assert(sendResA.data.chatMessage.senderName === "Phase6 Host", "Sender name saved correctly");

        // 6. Send Message (User B)
        const sendResB = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/messages`,
            { message: "Hello from Member User B" },
            { headers: { Authorization: `Bearer ${userB.token}`, "X-Organization-Id": orgAlphaId } }
        );
        assert(sendResB.status === 201, "User B sends message (201 Created)");
        const messageBId = sendResB.data.chatMessage._id;

        // 7. Message Persistence & Ordering
        const chatAfterSend = await axios.get(`${BASE_URL}/meetings/${meetingCode}/messages`, {
            headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
        });
        assert(chatAfterSend.status === 200 && chatAfterSend.data.messages.length === 2, "Both messages persisted and retrieved");
        assert(chatAfterSend.data.messages[0]._id === messageAId, "Message ordering is chronological (User A first)");
        assert(chatAfterSend.data.messages[1]._id === messageBId, "Message ordering is chronological (User B second)");

        // 8. Pagination
        const pageLimit1 = await axios.get(`${BASE_URL}/meetings/${meetingCode}/messages?limit=1`, {
            headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
        });
        assert(pageLimit1.data.messages.length === 1, "Pagination limit=1 returns 1 message");
        assert(pageLimit1.data.hasMore === true, "Pagination hasMore flag is true");

        // 9. Cross-Tenant Chat Isolation
        console.log("\n--- Testing Strict Tenant & Cross-Meeting Isolation ---");
        try {
            await axios.get(`${BASE_URL}/meetings/${meetingCode}/messages`, {
                headers: { Authorization: `Bearer ${userC.token}`, "X-Organization-Id": orgBetaId }
            });
            assert(false, "User C in Org Beta cannot read Org Alpha chat");
        } catch (err) {
            assert(err.response?.status === 403, "User C in Org Beta cannot read Org Alpha chat (403 Forbidden)");
        }

        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingCode}/messages`,
                { message: "Malicious cross-tenant message" },
                { headers: { Authorization: `Bearer ${userC.token}`, "X-Organization-Id": orgBetaId } }
            );
            assert(false, "User C in Org Beta cannot send message to Org Alpha chat");
        } catch (err) {
            assert(err.response?.status === 403, "User C in Org Beta cannot send message to Org Alpha chat (403 Forbidden)");
        }

        // 10. Message Moderation: Edit
        console.log("\n--- Testing Chat Message Moderation (Edit & Delete) ---");
        // Unauthorized edit: User B tries to edit User A's message
        try {
            await axios.patch(
                `${BASE_URL}/meetings/${meetingCode}/messages/${messageAId}`,
                { message: "Tampered message by User B" },
                { headers: { Authorization: `Bearer ${userB.token}`, "X-Organization-Id": orgAlphaId } }
            );
            assert(false, "Unauthorized message edit should be rejected");
        } catch (err) {
            assert(err.response?.status === 403, "Unauthorized message edit rejected (403 Forbidden)");
        }

        // Authorized edit: User A edits own message
        const authEdit = await axios.patch(
            `${BASE_URL}/meetings/${meetingCode}/messages/${messageAId}`,
            { message: "Hello from Host User A (Updated)" },
            { headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId } }
        );
        assert(authEdit.status === 200, "Authorized message edit succeeds (200 OK)");
        assert(authEdit.data.chatMessage.isEdited === true, "isEdited flag set to true");
        assert(authEdit.data.chatMessage.message === "Hello from Host User A (Updated)", "Message text updated");

        // 11. Message Moderation: Delete
        // Unauthorized delete: User B (non-host member) tries to delete User A's message
        try {
            await axios.delete(`${BASE_URL}/meetings/${meetingCode}/messages/${messageAId}`, {
                headers: { Authorization: `Bearer ${userB.token}`, "X-Organization-Id": orgAlphaId }
            });
            assert(false, "Non-host member deleting another's message should be rejected");
        } catch (err) {
            assert(err.response?.status === 403, "Non-host member deleting another's message rejected (403 Forbidden)");
        }

        // Authorized delete by host: Host User A deletes User B's message (moderation)
        const hostDelete = await axios.delete(`${BASE_URL}/meetings/${meetingCode}/messages/${messageBId}`, {
            headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
        });
        assert(hostDelete.status === 200, "Host moderating/deleting member message succeeds (200 OK)");
        assert(hostDelete.data.chatMessage.isDeleted === true, "isDeleted flag set to true");
        assert(hostDelete.data.chatMessage.message === "This message was deleted", "Message content replaced with deletion notice");

        // 12. Message Reactions
        console.log("\n--- Testing Reactions ---");
        const react1 = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/messages/${messageAId}/reactions`,
            { emoji: "👍" },
            { headers: { Authorization: `Bearer ${userB.token}`, "X-Organization-Id": orgAlphaId } }
        );
        assert(react1.status === 200, "User B reacts with 👍 (200 OK)");
        assert(react1.data.chatMessage.reactions.length === 1, "Reactions count is 1");
        assert(react1.data.chatMessage.reactions[0].emoji === "👍", "Reaction emoji matches");

        // Toggle reaction off
        const reactToggle = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/messages/${messageAId}/reactions`,
            { emoji: "👍" },
            { headers: { Authorization: `Bearer ${userB.token}`, "X-Organization-Id": orgAlphaId } }
        );
        assert(reactToggle.status === 200, "User B toggles reaction off (200 OK)");
        assert(reactToggle.data.chatMessage.reactions.length === 0, "Reaction successfully removed");

        // 13. Guest Access & Restrictions
        console.log("\n--- Testing Guest Read-Only Behavior ---");
        const guestRead = await axios.get(`${BASE_URL}/meetings/${meetingCode}/messages`);
        assert(guestRead.status === 200, "Guest views chat when allowGuestAccess=true (200 OK)");

        try {
            await axios.post(`${BASE_URL}/meetings/${meetingCode}/messages`, { message: "Guest attempting to post" });
            assert(false, "Guest should not be able to post messages");
        } catch (err) {
            assert(err.response?.status === 401, "Guest sending message rejected with 401 Unauthorized");
        }

        try {
            await axios.patch(`${BASE_URL}/meetings/${meetingCode}/messages/${messageAId}`, { message: "Guest attempting to edit" });
            assert(false, "Guest should not be able to edit messages");
        } catch (err) {
            assert(err.response?.status === 401, "Guest editing message rejected with 401 Unauthorized");
        }

        try {
            await axios.delete(`${BASE_URL}/meetings/${meetingCode}/messages/${messageAId}`);
            assert(false, "Guest should not be able to delete messages");
        } catch (err) {
            assert(err.response?.status === 401, "Guest deleting message rejected with 401 Unauthorized");
        }

        // 14. Input Validation
        console.log("\n--- Testing Input Validation ---");
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingCode}/messages`,
                { message: "   " },
                { headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId } }
            );
            assert(false, "Empty message should be rejected");
        } catch (err) {
            assert(err.response?.status === 400, "Empty message rejected with 400 Bad Request");
        }

        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingCode}/messages`,
                { message: "x".repeat(2001) },
                { headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId } }
            );
            assert(false, "Message exceeding 2000 chars should be rejected");
        } catch (err) {
            assert(err.response?.status === 400, "Message exceeding 2000 chars rejected with 400 Bad Request");
        }

        // 15. Socket.IO Real-time Events
        console.log("\n--- Testing Socket.IO Real-time Delivery, Typing & Presence ---");
        await new Promise((resolve) => {
            const socket1 = io(SOCKET_URL, { reconnection: false, forceNew: true });
            const socket2 = io(SOCKET_URL, { reconnection: false, forceNew: true });

            let presenceReceived = false;
            let typingReceived = false;
            let messageReceived = false;

            socket2.on("connect", () => {
                socket2.emit("join-call", `/${meetingCode}`, {
                    username: "Peer2",
                    userId: userB.user.id
                });
            });

            socket2.on("meeting:presence-update", (presenceList) => {
                if (!presenceReceived && presenceList && presenceList.length > 0) {
                    presenceReceived = true;
                    assert(true, "Peer 2 received 'meeting:presence-update' event");
                }
            });

            socket2.on("meeting:user-typing", ({ username, isTyping }) => {
                if (!typingReceived && isTyping) {
                    typingReceived = true;
                    assert(username === "Peer1", "Peer 2 received 'meeting:user-typing' for Peer 1");
                }
            });

            socket2.on("meeting:chat-message", (msg) => {
                if (!messageReceived && msg.message === "Realtime socket test message") {
                    messageReceived = true;
                    assert(true, "Peer 2 received real-time 'meeting:chat-message' delivery");

                    socket1.disconnect();
                    socket2.disconnect();
                    resolve();
                }
            });

            socket1.on("connect", () => {
                socket1.emit("join-call", `/${meetingCode}`, {
                    username: "Peer1",
                    userId: userA.user.id,
                    isHost: true
                });

                setTimeout(() => {
                    // Emit typing-start
                    socket1.emit("meeting:typing-start", { meetingCode });

                    // Emit chat-send
                    setTimeout(() => {
                        socket1.emit("meeting:chat-send", {
                            message: "Realtime socket test message",
                            sender: "Peer1"
                        });
                    }, 200);
                }, 300);
            });

            // Safety timeout
            setTimeout(() => {
                socket1.disconnect();
                socket2.disconnect();
                resolve();
            }, 4000);
        });

        // 16. Historical Chat Retrieval After Meeting End
        console.log("\n--- Testing Meeting History & Ended Meeting Persistence ---");
        const endRes = await axios.post(
            `${BASE_URL}/meetings/${meetingCode}/end`,
            {},
            { headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId } }
        );
        assert(endRes.status === 200, "Host ends meeting (200 OK)");

        const endedMeetingChat = await axios.get(`${BASE_URL}/meetings/${meetingCode}/messages`, {
            headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
        });
        assert(endedMeetingChat.status === 200, "Historical chat retrieved successfully for ended meeting");
        assert(endedMeetingChat.data.messages.length > 0, "Chat history remains persisted after meeting has ended");

        const verifyMeeting = await axios.get(`${BASE_URL}/meetings/${meetingCode}`, {
            headers: { Authorization: `Bearer ${userA.token}`, "X-Organization-Id": orgAlphaId }
        });
        assert(verifyMeeting.data.status === "ended", "Meeting status verified as 'ended' without being restarted");

        console.log(`\n=== TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED ===\n`);
        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (err) {
        console.error("Test execution failed with error:", err.message, err.response?.data);
        process.exit(1);
    }
}

runTests();
