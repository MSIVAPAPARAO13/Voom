import { Emitter } from "@socket.io/redis-emitter";
import { redisSubClient } from "../config/redis.js";

// Initialize emitter using the sub client
export const ioEmitter = new Emitter(redisSubClient);

/**
 * Cross-process helper to broadcast transcription events
 */
export const emitTranscriptionEvent = (meetingCode, eventName, payload) => {
    // We emit to all sockets in the meetingCode path (e.g., /meeting/123)
    // Wait, the client joins connections[path] but does it join a Socket.IO room?
    // Let's check if socketManager.js adds sockets to a room.
    // If socketManager.js doesn't use `socket.join(path)`, redis-emitter cannot target the room.
    // Let's emit globally or implement a cross-process channel.
};
