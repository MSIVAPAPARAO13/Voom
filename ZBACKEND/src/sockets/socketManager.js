import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redisClient, redisSubClient } from "../config/redis.js";
import { Meeting } from "../models/meeting.model.js";
import { Message } from "../models/message.model.js";
import { isUserMeetingMember, isUserMeetingHostOrAdmin } from "../controllers/meeting.controller.js";

/**
 * Real-time WebRTC Signaling, Room State, and Host Moderation Manager
 *
 * ARCHITECTURE OVERVIEW:
 * 1. WebRTC does NOT include a built-in signaling protocol.
 *    Peers exchange SDP offers/answers and ICE candidates out-of-band via Socket.IO.
 * 2. Socket.IO manages real-time meeting state, participant lists, host moderation events
 *    (mute, remove, end meeting), waiting room admission, and in-meeting chat.
 * 3. Once signaling finishes, audio/video flows directly between peer browsers.
 */

let connections = {};
let messages = {};
let timeOnline = {};
let participants = {};
let waitingRoom = {};
let hostSockets = {};
let typingUsers = {};
let ioInstance = null;

export const getIO = () => ioInstance;

import jwt from "jsonwebtoken";

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || "http://localhost:3000",
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Organization-Id"],
            credentials: true
        },
        adapter: createAdapter(redisClient, redisSubClient)
    });

    ioInstance = io;

    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
                socket.user = decoded;
            } catch (err) {
                // Token invalid, treat as guest
                socket.user = null;
            }
        } else {
            socket.user = null; // Guest
        }
        next();
    });

    io.on("connection", (socket) => {
        console.log("Socket connected:", socket.id, "User:", socket.user?.userId || "Guest");

        /**
         * EVENT: join-call
         * SENDER: Client entering a meeting room
         * RECEIVER: Server
         * PURPOSE: Registers user in the room, handles waiting room if enabled,
         *          announces to existing participants, and transmits chat history.
         */
        socket.on("join-call", async (path, metadata = {}) => {
            const cleanPath = (path || "").trim();
            const parts = cleanPath.split("/");
            const meetingCode = parts[parts.length - 1].split("?")[0];

            let meeting = null;
            try {
                meeting = await Meeting.findOne({ meetingCode });
            } catch (e) {
                console.error("Error querying meeting in join-call:", e.message);
            }

            // Reject join if meeting has ended
            if (meeting && meeting.status === "ended") {
                return socket.emit("meeting:ended", { message: "This meeting has already ended." });
            }

            // Determine host status using secure server-side logic
            let isHost = false;
            if (meeting && socket.user) {
                const userId = socket.user.id || socket.user.userId;
                isHost = await isUserMeetingHostOrAdmin(userId, meeting);
            }

            // Waiting Room check: if enabled and user is NOT host and not already approved
            const waitingRoomEnabled = meeting?.settings?.waitingRoomEnabled === true;
            if (waitingRoomEnabled && !isHost && !metadata.isApproved) {
                if (!waitingRoom[meetingCode]) {
                    waitingRoom[meetingCode] = [];
                }

                if (!waitingRoom[meetingCode].some(w => w.socketId === socket.id)) {
                    waitingRoom[meetingCode].push({
                        socketId: socket.id,
                        username: metadata.username || "Guest",
                        path: cleanPath
                    });
                }

                // Notify host sockets about waiting participant
                if (hostSockets[meetingCode]) {
                    hostSockets[meetingCode].forEach(hostSocketId => {
                        io.to(hostSocketId).emit("meeting:waiting-participant", {
                            socketId: socket.id,
                            username: metadata.username || "Guest"
                        });
                    });
                }

                return socket.emit("meeting:in-waiting-room", {
                    message: "Waiting room is enabled. Please wait for the host to admit you."
                });
            }

            // Register host socket
            if (isHost) {
                if (!hostSockets[meetingCode]) {
                    hostSockets[meetingCode] = new Set();
                }
                hostSockets[meetingCode].add(socket.id);
            }

            // Join room connections
            if (connections[cleanPath] === undefined) {
                connections[cleanPath] = [];
            }
            if (!connections[cleanPath].includes(socket.id)) {
                connections[cleanPath].push(socket.id);
            }
            timeOnline[socket.id] = new Date();

            // Track participant metadata
            participants[socket.id] = {
                socketId: socket.id,
                path: cleanPath,
                meetingCode,
                username: metadata.username || "Participant",
                userId: metadata.userId || null,
                isHost,
                isMuted: metadata.isMuted || false,
                isVideoOff: metadata.isVideoOff || false,
                isScreenSharing: false
            };

            // Notify all peers currently in the room about the new participant (PRESERVED CONTRACT)
            for (let a = 0; a < connections[cleanPath].length; a++) {
                io.to(connections[cleanPath][a]).emit("user-joined", socket.id, connections[cleanPath]);
            }

            // Broadcast updated participant list to room
            const roomParticipants = connections[cleanPath].map(id => participants[id] || { socketId: id, username: "Participant" });
            connections[cleanPath].forEach(id => {
                io.to(id).emit("meeting:participants-list", roomParticipants);
            });

            // Broadcast presence update
            const presenceList = connections[cleanPath].map(id => ({
                socketId: id,
                username: participants[id]?.username || "Participant",
                userId: participants[id]?.userId || null,
                status: "online"
            }));
            connections[cleanPath].forEach(id => {
                io.to(id).emit("meeting:presence-update", presenceList);
            });

            // Deliver existing chat messages for this room to newly joined peer (PRESERVED CONTRACT)
            if (messages[cleanPath] !== undefined) {
                for (let a = 0; a < messages[cleanPath].length; ++a) {
                    io.to(socket.id).emit(
                        "chat-message",
                        messages[cleanPath][a]["data"],
                        messages[cleanPath][a]["sender"],
                        messages[cleanPath][a]["socket-id-sender"]
                    );
                }
            }

            // PHASE 7: Deliver active recording state to joining/reconnecting peer
            const activeRecording = (meeting?.recordings || []).find(r => r.status === "recording");
            if (activeRecording) {
                socket.emit("meeting:recording-state", {
                    isRecording: true,
                    recordingId: activeRecording._id,
                    startedAt: activeRecording.startedAt,
                    startedByName: activeRecording.startedByName
                });
            } else {
                socket.emit("meeting:recording-state", {
                    isRecording: false
                });
            }
        });

        /**
         * EVENT: signal
         * Relays WebRTC SDP offers/answers and ICE candidates (PRESERVED CONTRACT)
         */
        socket.on("signal", (toId, message) => {
            const senderParticipant = participants[socket.id];
            const receiverParticipant = participants[toId];
            if (senderParticipant && receiverParticipant && senderParticipant.meetingCode === receiverParticipant.meetingCode) {
                io.to(toId).emit("signal", socket.id, message);
            }
        });

        /**
         * Shared helper to persist and broadcast chat messages
         */
        const handleChatMessage = async (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections).reduce(
                ([room, isFound], [roomKey, roomValue]) => {
                    if (!isFound && roomValue.includes(socket.id)) {
                        return [roomKey, true];
                    }
                    return [room, isFound];
                },
                ["", false]
            );

            if (found === true) {
                const p = participants[socket.id];
                const meetingCode = p?.meetingCode || matchingRoom.split("/").pop().split("?")[0];
                let meeting = null;
                try {
                    meeting = await Meeting.findOne({ meetingCode });
                } catch (e) { }

                if (meeting && meeting.settings && meeting.settings.allowChat === false && !p?.isHost) {
                    return socket.emit("meeting:chat-disabled", {
                        message: "Chat has been disabled by the host."
                    });
                }

                if (messages[matchingRoom] === undefined) {
                    messages[matchingRoom] = [];
                }

                messages[matchingRoom].push({
                    sender: sender,
                    data: data,
                    "socket-id-sender": socket.id
                });
                console.log("Message in room", matchingRoom, ":", sender, data);

                // Persist message in MongoDB Message collection
                let savedMessage = null;
                if (meeting) {
                    try {
                        savedMessage = new Message({
                            meeting: meeting._id,
                            meetingCode: meeting.meetingCode,
                            organization: meeting.organization,
                            sender: p?.userId || null,
                            senderName: sender || p?.username || "Participant",
                            message: data
                        });
                        await savedMessage.save();
                    } catch (e) {
                        console.error("Error persisting chat message:", e.message);
                    }
                }

                const chatPayload = savedMessage ? savedMessage.toObject() : {
                    _id: Date.now().toString(),
                    sender: p?.userId || null,
                    senderName: sender || p?.username || "Participant",
                    message: data,
                    createdAt: new Date(),
                    reactions: []
                };

                connections[matchingRoom].forEach((elem) => {
                    // Preserved Phase 4 contract
                    io.to(elem).emit("chat-message", data, sender, socket.id);
                    // Phase 6 persistent real-time contract
                    io.to(elem).emit("meeting:chat-message", chatPayload);
                });
            }
        };

        /**
         * EVENT: chat-message (Legacy & fallback)
         */
        socket.on("chat-message", async (data, sender) => {
            await handleChatMessage(data, sender);
        });

        /**
         * EVENT: meeting:chat-send (Phase 6 persistent chat)
         */
        socket.on("meeting:chat-send", async ({ message, sender }) => {
            await handleChatMessage(message, sender);
        });

        /**
         * EVENT: meeting:chat-edit
         */
        socket.on("meeting:chat-edit", async ({ meetingCode, messageId, message }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode || !p.userId) {
                return socket.emit("meeting:error", { message: "Unauthorized." });
            }
            if (!message || typeof message !== "string" || !message.trim()) return;

            try {
                const chatMessage = await Message.findById(messageId);
                if (!chatMessage || chatMessage.meetingCode !== meetingCode) return;
                if (chatMessage.sender && chatMessage.sender.toString() !== p.userId.toString()) {
                    return socket.emit("meeting:error", { message: "You can only edit your own messages." });
                }
                if (chatMessage.isDeleted) return;

                chatMessage.message = message.trim();
                chatMessage.isEdited = true;
                chatMessage.updatedAt = new Date();
                await chatMessage.save();

                if (connections[p.path]) {
                    connections[p.path].forEach(id => {
                        io.to(id).emit("meeting:chat-edited", chatMessage);
                    });
                }
            } catch (e) {
                console.error("Error in meeting:chat-edit:", e.message);
            }
        });

        /**
         * EVENT: meeting:chat-delete
         */
        socket.on("meeting:chat-delete", async ({ meetingCode, messageId }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode || !p.userId) {
                return socket.emit("meeting:error", { message: "Unauthorized." });
            }

            try {
                const meeting = await Meeting.findOne({ meetingCode });
                const chatMessage = await Message.findById(messageId);
                if (!meeting || !chatMessage || chatMessage.meetingCode !== meetingCode) return;

                const isAuthor = chatMessage.sender && chatMessage.sender.toString() === p.userId.toString();
                const isHost = await isUserMeetingHostOrAdmin(p.userId, meeting);

                if (!isAuthor && !isHost) {
                    return socket.emit("meeting:error", { message: "Unauthorized to delete this message." });
                }

                chatMessage.isDeleted = true;
                chatMessage.message = "This message was deleted";
                chatMessage.updatedAt = new Date();
                await chatMessage.save();

                if (connections[p.path]) {
                    connections[p.path].forEach(id => {
                        io.to(id).emit("meeting:chat-deleted", { messageId, meetingCode });
                    });
                }
            } catch (e) {
                console.error("Error in meeting:chat-delete:", e.message);
            }
        });

        /**
         * EVENT: meeting:chat-react
         */
        socket.on("meeting:chat-react", async ({ meetingCode, messageId, emoji }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode || !p.userId) {
                return socket.emit("meeting:error", { message: "Unauthorized." });
            }
            if (!emoji || typeof emoji !== "string" || !emoji.trim()) return;

            try {
                const chatMessage = await Message.findById(messageId);
                if (!chatMessage || chatMessage.meetingCode !== meetingCode || chatMessage.isDeleted) return;

                const existingIndex = chatMessage.reactions.findIndex(
                    r => r.user.toString() === p.userId.toString() && r.emoji === emoji.trim()
                );

                if (existingIndex > -1) {
                    chatMessage.reactions.splice(existingIndex, 1);
                } else {
                    chatMessage.reactions.push({
                        emoji: emoji.trim(),
                        user: p.userId,
                        username: p.username || "Participant",
                        createdAt: new Date()
                    });
                }

                await chatMessage.save();

                if (connections[p.path]) {
                    connections[p.path].forEach(id => {
                        io.to(id).emit("meeting:reaction-updated", { messageId, reactions: chatMessage.reactions });
                    });
                }
            } catch (e) {
                console.error("Error in meeting:chat-react:", e.message);
            }
        });

        /**
         * EVENT: meeting:typing-start
         */
        socket.on("meeting:typing-start", ({ meetingCode }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode) return;

            if (!typingUsers[meetingCode]) {
                typingUsers[meetingCode] = {};
            }
            typingUsers[meetingCode][socket.id] = {
                username: p.username || "Participant",
                userId: p.userId || null
            };

            if (connections[p.path]) {
                connections[p.path].forEach(id => {
                    if (id !== socket.id) {
                        io.to(id).emit("meeting:user-typing", {
                            socketId: socket.id,
                            username: p.username || "Participant",
                            isTyping: true
                        });
                    }
                });
            }
        });

        /**
         * EVENT: meeting:typing-stop
         */
        socket.on("meeting:typing-stop", ({ meetingCode }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode) return;

            if (typingUsers[meetingCode]) {
                delete typingUsers[meetingCode][socket.id];
            }

            if (connections[p.path]) {
                connections[p.path].forEach(id => {
                    if (id !== socket.id) {
                        io.to(id).emit("meeting:user-typing", {
                            socketId: socket.id,
                            username: p.username || "Participant",
                            isTyping: false
                        });
                    }
                });
            }
        });

        /**
         * EVENT: meeting:state-update
         * Updates audio/video/screen share state in participant list
         */
        socket.on("meeting:state-update", (state) => {
            if (participants[socket.id]) {
                if (typeof state.isMuted === "boolean") participants[socket.id].isMuted = state.isMuted;
                if (typeof state.isVideoOff === "boolean") participants[socket.id].isVideoOff = state.isVideoOff;
                if (typeof state.isScreenSharing === "boolean") participants[socket.id].isScreenSharing = state.isScreenSharing;

                const p = participants[socket.id];
                if (connections[p.path]) {
                    const roomParticipants = connections[p.path].map(id => participants[id] || { socketId: id, username: "Participant" });
                    connections[p.path].forEach(id => io.to(id).emit("meeting:participants-list", roomParticipants));
                }
            }
        });

        /**
         * EVENT: meeting:mute-participant
         * Host mutes a specific participant
         */
        socket.on("meeting:mute-participant", ({ targetSocketId, meetingCode }) => {
            if (!hostSockets[meetingCode]?.has(socket.id)) {
                return socket.emit("meeting:error", { message: "Only the meeting host can mute participants." });
            }

            if (participants[targetSocketId]) {
                participants[targetSocketId].isMuted = true;
            }
            io.to(targetSocketId).emit("meeting:participant-muted");

            const p = participants[targetSocketId];
            if (p && connections[p.path]) {
                const roomParticipants = connections[p.path].map(id => participants[id] || { socketId: id, username: "Participant" });
                connections[p.path].forEach(id => io.to(id).emit("meeting:participants-list", roomParticipants));
            }
        });

        /**
         * EVENT: meeting:remove-participant
         * Host removes a specific participant
         */
        socket.on("meeting:remove-participant", ({ targetSocketId, meetingCode }) => {
            if (!hostSockets[meetingCode]?.has(socket.id)) {
                return socket.emit("meeting:error", { message: "Only the meeting host can remove participants." });
            }

            io.to(targetSocketId).emit("meeting:participant-removed", {
                message: "You have been removed from the meeting by the host."
            });

            const p = participants[targetSocketId];
            if (p && connections[p.path]) {
                const idx = connections[p.path].indexOf(targetSocketId);
                if (idx !== -1) {
                    connections[p.path].splice(idx, 1);
                }
                connections[p.path].forEach(id => io.to(id).emit("user-left", targetSocketId));
                const roomParticipants = connections[p.path].map(id => participants[id] || { socketId: id, username: "Participant" });
                connections[p.path].forEach(id => io.to(id).emit("meeting:participants-list", roomParticipants));
            }
            delete participants[targetSocketId];
        });

        /**
         * EVENT: meeting:end
         * Host ends the meeting for all participants
         */
        socket.on("meeting:end", async ({ meetingCode }) => {
            if (!hostSockets[meetingCode]?.has(socket.id)) {
                return socket.emit("meeting:error", { message: "Only the meeting host can end the meeting." });
            }

            try {
                const meeting = await Meeting.findOne({ meetingCode });
                if (meeting) {
                    meeting.status = "ended";
                    meeting.endedAt = new Date();
                    // PHASE 7: Finalize active recording if any
                    if (meeting.recordings && meeting.recordings.length > 0) {
                        meeting.recordings.forEach(rec => {
                            if (rec.status === "recording" || rec.status === "processing") {
                                rec.status = (rec.storageKey && rec.fileSize > 0) ? "ready" : "failed";
                                rec.endedAt = rec.endedAt || new Date();
                                if (!rec.duration && rec.startedAt) {
                                    rec.duration = Math.max(1, Math.round((rec.endedAt.getTime() - new Date(rec.startedAt).getTime()) / 1000));
                                }
                            }
                        });
                    }
                    await meeting.save();
                }
            } catch (e) {
                console.error("Failed to update meeting status to ended:", e);
            }

            const p = participants[socket.id];
            if (p && connections[p.path]) {
                connections[p.path].forEach(id => {
                    io.to(id).emit("meeting:ended", { message: "The meeting has been ended by the host." });
                });
                delete connections[p.path];
                delete messages[p.path];
            }

            delete hostSockets[meetingCode];
            delete waitingRoom[meetingCode];
        });

        /**
         * EVENT: meeting:update-settings
         * Host updates meeting settings in realtime
         */
        socket.on("meeting:update-settings", async ({ meetingCode, settings }) => {
            if (!hostSockets[meetingCode]?.has(socket.id)) {
                return socket.emit("meeting:error", { message: "Only the meeting host can update settings." });
            }

            try {
                await Meeting.updateOne({ meetingCode }, { $set: { settings } });
            } catch (e) {
                console.error("Failed to persist updated settings in DB:", e);
            }

            const p = participants[socket.id];
            if (p && connections[p.path]) {
                connections[p.path].forEach(id => {
                    io.to(id).emit("meeting:settings-updated", settings);
                });
            }
        });

        /**
         * EVENT: meeting:approve-participant
         * Host admits a waiting participant
         */
        socket.on("meeting:approve-participant", ({ targetSocketId, meetingCode }) => {
            if (!hostSockets[meetingCode]?.has(socket.id)) {
                return socket.emit("meeting:error", { message: "Only the host can admit participants." });
            }

            if (waitingRoom[meetingCode]) {
                waitingRoom[meetingCode] = waitingRoom[meetingCode].filter(w => w.socketId !== targetSocketId);
            }
            io.to(targetSocketId).emit("meeting:join-approved");
        });

        /**
         * EVENT: meeting:reject-participant
         * Host denies admission to a waiting participant
         */
        socket.on("meeting:reject-participant", ({ targetSocketId, meetingCode }) => {
            if (!hostSockets[meetingCode]?.has(socket.id)) {
                return socket.emit("meeting:error", { message: "Only the host can deny admission." });
            }

            if (waitingRoom[meetingCode]) {
                waitingRoom[meetingCode] = waitingRoom[meetingCode].filter(w => w.socketId !== targetSocketId);
            }
            io.to(targetSocketId).emit("meeting:join-rejected", {
                message: "The host has denied admission to this meeting."
            });
        });

        // ==========================================
        // PHASE 5: WORKSPACE REAL-TIME COLLABORATION
        // ==========================================

        /**
         * EVENT: meeting:notes-update
         * Synchronizes shared meeting notes across room participants.
         * Server validates meeting existence and participant organization membership.
         */
        socket.on("meeting:notes-update", async ({ meetingCode, content }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode) {
                return socket.emit("meeting:error", { message: "Unauthorized socket for this meeting." });
            }

            // Only authenticated members can update notes (guests are read-only)
            if (!p.userId) {
                return socket.emit("meeting:error", { message: "Guests cannot update notes." });
            }

            if (typeof content !== "string" || content.length > 50000) {
                return socket.emit("meeting:error", { message: "Notes content exceeds limit." });
            }

            try {
                const meeting = await Meeting.findOne({ meetingCode });
                if (!meeting) return;

                const isMember = await isUserMeetingMember(p.userId, meeting);
                if (!isMember) {
                    return socket.emit("meeting:error", { message: "Only organization members can update notes." });
                }

                if (!meeting.workspace) meeting.workspace = {};
                if (!meeting.workspace.notes) meeting.workspace.notes = { version: 1 };

                meeting.workspace.notes.content = content;
                meeting.workspace.notes.updatedBy = p.userId;
                meeting.workspace.notes.updatedAt = new Date();
                meeting.workspace.notes.version = (meeting.workspace.notes.version || 1) + 1;

                await meeting.save();

                // Broadcast updated notes strictly to this meeting room
                if (connections[p.path]) {
                    connections[p.path].forEach(id => {
                        io.to(id).emit("meeting:notes-updated", meeting.workspace.notes);
                    });
                }
            } catch (e) {
                console.error("Error updating notes via socket:", e.message);
            }
        });

        /**
         * EVENT: meeting:agenda-update
         * Broadcasts updated agenda list to meeting participants.
         */
        socket.on("meeting:agenda-update", async ({ meetingCode }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode) return;

            try {
                const meeting = await Meeting.findOne({ meetingCode });
                if (meeting && connections[p.path]) {
                    connections[p.path].forEach(id => {
                        io.to(id).emit("meeting:agenda-updated", meeting.workspace?.agenda || []);
                    });
                }
            } catch (e) { }
        });

        /**
         * EVENT: meeting:task-update
         * Broadcasts updated tasks list to meeting participants.
         */
        socket.on("meeting:task-update", async ({ meetingCode }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode) return;

            try {
                const meeting = await Meeting.findOne({ meetingCode })
                    .populate("workspace.tasks.assignedTo", "name username");
                if (meeting && connections[p.path]) {
                    connections[p.path].forEach(id => {
                        io.to(id).emit("meeting:task-updated", meeting.workspace?.tasks || []);
                    });
                }
            } catch (e) { }
        });

        /**
         * EVENT: meeting:resource-update
         * Broadcasts updated resources list to meeting participants.
         */
        socket.on("meeting:resource-update", async ({ meetingCode }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode) return;

            try {
                const meeting = await Meeting.findOne({ meetingCode });
                if (meeting && connections[p.path]) {
                    connections[p.path].forEach(id => {
                        io.to(id).emit("meeting:resource-updated", meeting.workspace?.resources || []);
                    });
                }
            } catch (e) { }
        });

        // ==========================================
        // PHASE 7: RECORDING REALTIME SYNCHRONIZATION
        // ==========================================

        /**
         * EVENT: meeting:recording-start
         * Host initiates recording via Socket.IO.
         * Authorizes user, creates recording metadata, and broadcasts to room.
         */
        socket.on("meeting:recording-start", async ({ meetingCode }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode) {
                return socket.emit("meeting:error", { message: "Unauthorized socket for this meeting." });
            }

            if (!p.userId) {
                return socket.emit("meeting:error", { message: "Guests cannot start recordings." });
            }

            try {
                const meeting = await Meeting.findOne({ meetingCode });
                if (!meeting) {
                    return socket.emit("meeting:error", { message: "Meeting not found." });
                }

                const isHostOrAdmin = await isUserMeetingHostOrAdmin(p.userId, meeting);
                if (!isHostOrAdmin) {
                    return socket.emit("meeting:error", { message: "Only the meeting host or organization admin can start recording." });
                }

                if (meeting.settings && meeting.settings.allowRecording === false) {
                    return socket.emit("meeting:error", { message: "Recording is disabled for this meeting." });
                }

                if (meeting.status === "ended") {
                    return socket.emit("meeting:error", { message: "Cannot record an ended meeting." });
                }

                const activeRec = (meeting.recordings || []).find(r => r.status === "recording");
                if (activeRec) {
                    return socket.emit("meeting:error", { message: "A recording is already in progress." });
                }

                const newRecording = {
                    startedBy: p.userId,
                    startedByName: p.username || "Host",
                    startedAt: new Date(),
                    status: "recording",
                    storageProvider: "local",
                    storageKey: "",
                    mimeType: "video/webm"
                };

                meeting.recordings.push(newRecording);
                await meeting.save();

                const created = meeting.recordings[meeting.recordings.length - 1];

                // Broadcast to room
                if (connections[p.path]) {
                    connections[p.path].forEach(id => {
                        io.to(id).emit("meeting:recording-started", {
                            recordingId: created._id,
                            startedAt: created.startedAt,
                            startedByName: created.startedByName
                        });
                    });
                }
            } catch (err) {
                console.error("Error starting recording via socket:", err.message);
                socket.emit("meeting:error", { message: "Failed to start recording." });
            }
        });

        /**
         * EVENT: meeting:recording-stop
         * Host signals recording stop.
         * Broadcasts to participants that recording has stopped/finalizing.
         */
        socket.on("meeting:recording-stop", async ({ meetingCode, recordingId }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode) return;

            if (!p.userId) {
                return socket.emit("meeting:error", { message: "Guests cannot stop recordings." });
            }

            try {
                const meeting = await Meeting.findOne({ meetingCode });
                if (!meeting) return;

                const isHostOrAdmin = await isUserMeetingHostOrAdmin(p.userId, meeting);
                if (!isHostOrAdmin) {
                    return socket.emit("meeting:error", { message: "Only host can stop recording." });
                }

                if (connections[p.path]) {
                    connections[p.path].forEach(id => {
                        io.to(id).emit("meeting:recording-stopped", {
                            recordingId,
                            meetingCode
                        });
                    });
                }
            } catch (err) {
                console.error("Error stopping recording via socket:", err.message);
            }
        });

        /**
         * EVENT: meeting:recording-ready
         * Broadcasts when media file upload is finalized.
         */
        socket.on("meeting:recording-ready", ({ meetingCode, recordingId }) => {
            const p = participants[socket.id];
            if (!p || p.meetingCode !== meetingCode) return;

            if (connections[p.path]) {
                connections[p.path].forEach(id => {
                    io.to(id).emit("meeting:recording-ready", {
                        recordingId,
                        meetingCode
                    });
                });
            }
        });

        /**
         * EVENT: disconnect
         * SENDER: Socket disconnect event
         * Clean up connections, participant metadata, and inform remaining peers (PRESERVED CONTRACT)
         */

        socket.on("disconnect", () => {
            for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
                for (let a = 0; a < v.length; ++a) {
                    if (v[a] === socket.id) {
                        const key = k;

                        // Inform all remaining peers in this room that this peer left
                        for (let b = 0; b < connections[key].length; ++b) {
                            io.to(connections[key][b]).emit("user-left", socket.id);
                        }

                        const index = connections[key].indexOf(socket.id);
                        connections[key].splice(index, 1);

                        if (connections[key].length === 0) {
                            delete connections[key];
                        } else {
                            // Broadcast updated participant list to remaining peers
                            const roomParticipants = connections[key].map(id => participants[id] || { socketId: id, username: "Participant" });
                            connections[key].forEach(id => io.to(id).emit("meeting:participants-list", roomParticipants));

                            // Broadcast presence update
                            const presenceList = connections[key].map(id => ({
                                socketId: id,
                                username: participants[id]?.username || "Participant",
                                userId: participants[id]?.userId || null,
                                status: "online"
                            }));
                            connections[key].forEach(id => io.to(id).emit("meeting:presence-update", presenceList));
                        }
                    }
                }
            }

            // Clean up host sockets, typing state, and participant data
            const p = participants[socket.id];
            if (p) {
                if (hostSockets[p.meetingCode]) {
                    hostSockets[p.meetingCode].delete(socket.id);
                }
                if (waitingRoom[p.meetingCode]) {
                    waitingRoom[p.meetingCode] = waitingRoom[p.meetingCode].filter(w => w.socketId !== socket.id);
                }
                if (typingUsers[p.meetingCode]) {
                    delete typingUsers[p.meetingCode][socket.id];
                }
                delete participants[socket.id];
            }
        });
    });

    return io;
};

/**
 * PHASE 8: Real-time Transcription Event Broadcast
 * Synchronizes transcription lifecycle states (started, processing, completed, failed)
 * across connected meeting participants without exposing provider secrets or raw stack traces.
 */
export const broadcastTranscriptionEvent = (meetingCode, eventName, payload) => {
    if (!ioInstance) return;

    // Direct room emit
    ioInstance.to(meetingCode).emit(eventName, payload);

    // Also broadcast to URL-path indexed connections
    Object.keys(connections).forEach(key => {
        const parts = key.split("/");
        const code = parts[parts.length - 1].split("?")[0];
        if (code === meetingCode && Array.isArray(connections[key])) {
            connections[key].forEach(socketId => {
                ioInstance.to(socketId).emit(eventName, payload);
            });
        }
    });
};

/**
 * PHASE 9: Broadcast Meeting AI Intelligence Events
 * Synchronizes AI intelligence lifecycle states (started, processing, completed, failed)
 * across connected meeting participants without exposing secrets or raw stack traces.
 */
export const broadcastAIEvent = (meetingCode, eventName, payload) => {
    if (!ioInstance) return;

    // Direct room emit
    ioInstance.to(meetingCode).emit(eventName, payload);

    // Also broadcast to URL-path indexed connections
    Object.keys(connections).forEach(key => {
        const parts = key.split("/");
        const code = parts[parts.length - 1].split("?")[0];
        if (code === meetingCode && Array.isArray(connections[key])) {
            connections[key].forEach(socketId => {
                ioInstance.to(socketId).emit(eventName, payload);
            });
        }
    });
};

// =========================================================================
// PHASE 12: WORKER-TO-API NOTIFICATIONS VIA REDIS PUB/SUB
// =========================================================================

redisSubClient.subscribe("worker:events", (err) => {
    if (err) console.error("Failed to subscribe to worker:events", err);
});

redisSubClient.on("message", (channel, message) => {
    if (channel === "worker:events") {
        try {
            const data = JSON.parse(message);
            if (data.type === "transcription") {
                broadcastTranscriptionEvent(data.meetingCode, data.eventName, data.payload);
            } else if (data.type === "ai") {
                broadcastAIEvent(data.meetingCode, data.eventName, data.payload);
            }
        } catch (e) {
            console.error("Failed to process worker event message", e);
        }
    }
});
