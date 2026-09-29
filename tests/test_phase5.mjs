import axios from "axios";
import { io } from "socket.io-client";

const BASE_URL = "http://localhost:8000/api/v1";
const SOCKET_URL = "http://localhost:8000";

async function runTests() {
    console.log("=== STARTING PHASE 5 AUTOMATED TEST SUITE ===");
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
            } catch (e) { }
            const loginRes = await axios.post(`${BASE_URL}/users/login`, { username, password });
            return {
                token: loginRes.data.accessToken,
                user: loginRes.data.user
            };
        };

        const ts = Date.now();
        console.log("\n--- Creating Test Users & Organizations ---");
        const userA = await registerAndLogin(`p5_host_${ts}`, "Pass123!@#", "Phase5 Host");
        const userB = await registerAndLogin(`p5_other_${ts}`, "Pass123!@#", "Phase5 OtherOrg");
        const userC = await registerAndLogin(`p5_member_${ts}`, "Pass123!@#", "Phase5 Member");

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

        console.log("\n--- Creating Meeting With Workspace ---");
        // User A creates meeting in Org Alpha
        const meetingAlphaRes = await axios.post(
            `${BASE_URL}/meetings`,
            {
                title: "Collaboration Sync",
                description: "Sprint planning and workspace review",
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
        const meetingAlpha = meetingAlphaRes.data.meeting;
        assert(meetingAlphaRes.status === 201, "Meeting in Org Alpha created with 201 Created");

        // User B creates meeting in Org Beta
        const meetingBetaRes = await axios.post(
            `${BASE_URL}/meetings`,
            {
                title: "Beta Private Meeting",
                settings: {
                    allowGuestAccess: false
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${userB.token}`,
                    "X-Organization-Id": orgBetaId
                }
            }
        );
        const meetingBeta = meetingBetaRes.data.meeting;

        console.log("\n--- Testing Workspace Retrieval & Tenant Isolation ---");
        // Member of Alpha (User A) accesses Alpha workspace -> 200 OK
        const wsAlpha = await axios.get(`${BASE_URL}/meetings/${meetingAlpha.meetingCode}/workspace`, {
            headers: { Authorization: `Bearer ${userA.token}` }
        });
        assert(wsAlpha.status === 200, "User A accesses Alpha meeting workspace (200 OK)");
        assert(wsAlpha.data.workspace.notes !== undefined, "Workspace contains notes object");
        assert(Array.isArray(wsAlpha.data.workspace.agenda), "Workspace contains agenda array");
        assert(Array.isArray(wsAlpha.data.workspace.tasks), "Workspace contains tasks array");
        assert(Array.isArray(wsAlpha.data.workspace.resources), "Workspace contains resources array");

        // User A attempts to access Org Beta's private workspace -> 403 Forbidden
        let crossTenantWsBlocked = false;
        try {
            await axios.get(`${BASE_URL}/meetings/${meetingBeta.meetingCode}/workspace`, {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            });
        } catch (e) {
            if (e.response && e.response.status === 403) crossTenantWsBlocked = true;
        }
        assert(crossTenantWsBlocked, "User A cannot access Org Beta meeting workspace (403 Forbidden)");

        // User A attempts to update notes in Org Beta -> 403 Forbidden
        let crossTenantNotesBlocked = false;
        try {
            await axios.patch(
                `${BASE_URL}/meetings/${meetingBeta.meetingCode}/notes`,
                { content: "Hacked notes" },
                {
                    headers: {
                        Authorization: `Bearer ${userA.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
        } catch (e) {
            if (e.response && e.response.status === 403) crossTenantNotesBlocked = true;
        }
        assert(crossTenantNotesBlocked, "User A cannot update notes in Org Beta (403 Forbidden)");

        // User A attempts to create task in Org Beta -> 403 Forbidden
        let crossTenantTaskBlocked = false;
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingBeta.meetingCode}/tasks`,
                { title: "Malicious Task" },
                {
                    headers: {
                        Authorization: `Bearer ${userA.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
        } catch (e) {
            if (e.response && e.response.status === 403) crossTenantTaskBlocked = true;
        }
        assert(crossTenantTaskBlocked, "User A cannot create task in Org Beta (403 Forbidden)");

        console.log("\n--- Testing Notes Persistence & Versioning ---");
        // User A updates notes
        const updateNotesRes = await axios.patch(
            `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/notes`,
            { content: "# Sprint Notes\n- Completed Phase 4\n- Started Phase 5" },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(updateNotesRes.status === 200, "Notes updated successfully (200 OK)");
        assert(updateNotesRes.data.notes.version === 2, "Notes version incremented to 2");

        // Reload workspace to verify persistence
        const reloadWs = await axios.get(`${BASE_URL}/meetings/${meetingAlpha.meetingCode}/workspace`, {
            headers: { Authorization: `Bearer ${userA.token}` }
        });
        assert(reloadWs.data.workspace.notes.content.includes("Completed Phase 4"), "Notes persisted and reloaded from DB");

        console.log("\n--- Testing Agenda Operations ---");
        // Create agenda item
        const addAgendaRes = await axios.post(
            `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/agenda`,
            {
                title: "1. Architecture Review",
                description: "Review shared workspace model",
                duration: 20
            },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(addAgendaRes.status === 201, "Agenda item created (201 Created)");
        const agendaItem = addAgendaRes.data.item;

        // Update status to active
        const updateAgendaRes1 = await axios.patch(
            `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/agenda/${agendaItem._id}`,
            { status: "active" },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(updateAgendaRes1.data.item.status === "active", "Agenda item updated to 'active'");

        // Update status to completed
        const updateAgendaRes2 = await axios.patch(
            `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/agenda/${agendaItem._id}`,
            { status: "completed" },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(updateAgendaRes2.data.item.status === "completed", "Agenda item updated to 'completed'");

        // Delete agenda item
        const deleteAgendaRes = await axios.delete(
            `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/agenda/${agendaItem._id}`,
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(deleteAgendaRes.status === 200, "Agenda item deleted successfully");

        console.log("\n--- Testing Tasks & Assignment Security ---");
        // Assign task to valid Org Alpha member (User C) -> 201 Created
        const createTaskRes = await axios.post(
            `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/tasks`,
            {
                title: "Deploy Voom to Staging",
                description: "Setup Render and Atlas",
                assignedTo: userC.user.id,
                dueDate: new Date(Date.now() + 86400000).toISOString()
            },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(createTaskRes.status === 201, "Task assigned to valid org member (201 Created)");
        const task1 = createTaskRes.data.task;

        // Attempt to assign task to external non-member (User B from Org Beta) -> 400 Bad Request
        let externalAssignmentBlocked = false;
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/tasks`,
                {
                    title: "Security Leak Task",
                    assignedTo: userB.user.id
                },
                {
                    headers: {
                        Authorization: `Bearer ${userA.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
        } catch (e) {
            if (e.response && (e.response.status === 400 || e.response.status === 403)) {
                externalAssignmentBlocked = true;
            }
        }
        assert(externalAssignmentBlocked, "Assigning task to non-org member rejected with 400/403");

        // Assigned member (User C) updates task status
        const updateTaskRes = await axios.patch(
            `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/tasks/${task1._id}`,
            { status: "in_progress" },
            {
                headers: {
                    Authorization: `Bearer ${userC.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(updateTaskRes.status === 200 && updateTaskRes.data.task.status === "in_progress", "Assigned member updates task status to 'in_progress'");

        console.log("\n--- Testing Resources & URL Validation ---");
        // Add valid HTTPS resource
        const addResourceRes = await axios.post(
            `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/resources`,
            {
                title: "Voom Repository",
                url: "https://github.com/MSIVAPAPARAO13/Voom",
                type: "repository",
                description: "Main source repository"
            },
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(addResourceRes.status === 201, "Valid HTTPS resource added (201 Created)");
        const resource1 = addResourceRes.data.resource;

        // Add invalid URL (not http/https) -> 400 Bad Request
        let invalidUrlBlocked = false;
        try {
            await axios.post(
                `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/resources`,
                {
                    title: "Malicious Link",
                    url: "javascript:alert(1)",
                    type: "link"
                },
                {
                    headers: {
                        Authorization: `Bearer ${userA.token}`,
                        "X-Organization-Id": orgAlphaId
                    }
                }
            );
        } catch (e) {
            if (e.response && e.response.status === 400) invalidUrlBlocked = true;
        }
        assert(invalidUrlBlocked, "Invalid non-http URL rejected with 400 Bad Request");

        // Delete resource
        const deleteResourceRes = await axios.delete(
            `${BASE_URL}/meetings/${meetingAlpha.meetingCode}/resources/${resource1._id}`,
            {
                headers: {
                    Authorization: `Bearer ${userA.token}`,
                    "X-Organization-Id": orgAlphaId
                }
            }
        );
        assert(deleteResourceRes.status === 200, "Resource deleted successfully");

        console.log("\n--- Testing Guest Read-Only & Restriction ---");
        // Unauthenticated guest views Alpha workspace (allowGuestAccess = true)
        const guestWs = await axios.get(`${BASE_URL}/meetings/${meetingAlpha.meetingCode}/workspace`);
        assert(guestWs.status === 200, "Guest views workspace when allowGuestAccess=true");
        assert(guestWs.data.isReadOnly === true, "Guest workspace marked isReadOnly: true");

        // Unauthenticated guest attempts to edit notes -> 401 Unauthorized
        let guestNotesBlocked = false;
        try {
            await axios.patch(`${BASE_URL}/meetings/${meetingAlpha.meetingCode}/notes`, { content: "Guest hack" });
        } catch (e) {
            if (e.response && (e.response.status === 401 || e.response.status === 403)) guestNotesBlocked = true;
        }
        assert(guestNotesBlocked, "Guest editing notes rejected with 401 Unauthorized");

        // Unauthenticated guest attempts to create task -> 401 Unauthorized
        let guestTaskBlocked = false;
        try {
            await axios.post(`${BASE_URL}/meetings/${meetingAlpha.meetingCode}/tasks`, { title: "Guest Task" });
        } catch (e) {
            if (e.response && (e.response.status === 401 || e.response.status === 403)) guestTaskBlocked = true;
        }
        assert(guestTaskBlocked, "Guest creating task rejected with 401 Unauthorized");

        console.log("\n--- Testing Socket.IO Real-time Synchronization ---");
        // Connect sockets for User A and User C
        const socketHost = io(SOCKET_URL, { transports: ["websocket"] });
        const socketMember = io(SOCKET_URL, { transports: ["websocket"] });

        let hostJoined = false;
        let memberJoined = false;
        let notesSyncReceived = false;
        let taskSyncReceived = false;

        await new Promise((resolve) => {
            let joinedCount = 0;
            const onJoined = () => {
                joinedCount++;
                if (joinedCount === 2) resolve();
            };

            socketHost.on("connect", () => {
                socketHost.emit("join-call", `/${meetingAlpha.meetingCode}`, {
                    username: "HostUser",
                    userId: userA.user.id,
                    isHost: true
                });
                hostJoined = true;
            });

            socketMember.on("connect", () => {
                socketMember.emit("join-call", `/${meetingAlpha.meetingCode}`, {
                    username: "MemberUser",
                    userId: userC.user.id,
                    isHost: false
                });
                memberJoined = true;
            });

            socketHost.on("user-joined", () => onJoined());
            socketMember.on("user-joined", () => onJoined());
        });

        assert(hostJoined && memberJoined, "Both peers connected to Socket.IO room");

        // Peer 1 updates notes -> Peer 2 receives 'meeting:notes-updated'
        await new Promise((resolve) => {
            socketMember.on("meeting:notes-updated", (notes) => {
                if (notes.content.includes("Realtime Notes Update")) {
                    notesSyncReceived = true;
                    resolve();
                }
            });
            socketHost.emit("meeting:notes-update", {
                meetingCode: meetingAlpha.meetingCode,
                content: "Realtime Notes Update from Host"
            });
        });
        assert(notesSyncReceived, "Peer 2 received 'meeting:notes-updated' event in real time");

        // Peer 1 triggers task update -> Peer 2 receives 'meeting:task-updated'
        await new Promise((resolve) => {
            socketMember.on("meeting:task-updated", (tasks) => {
                taskSyncReceived = true;
                resolve();
            });
            socketHost.emit("meeting:task-update", {
                meetingCode: meetingAlpha.meetingCode
            });
        });
        assert(taskSyncReceived, "Peer 2 received 'meeting:task-updated' event in real time");

        // Clean up sockets
        socketHost.disconnect();
        socketMember.disconnect();

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
