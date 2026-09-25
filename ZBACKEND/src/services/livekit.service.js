import { AccessToken } from 'livekit-server-sdk';
import crypto from 'crypto';

/**
 * Service to generate LiveKit access tokens and manage identities.
 * Does NOT perform authorization. The controller must authorize before calling this.
 */
export const livekitService = {
    /**
     * Generate a LiveKit realtime token for an authorized participant.
     * 
     * @param {Object} params
     * @param {string} params.meetingId - The MongoDB meeting ObjectId (canonical identity)
     * @param {string} params.userId - Optional Voom user ID (for members)
     * @param {boolean} params.isHost - Is the user the host/admin
     * @param {string} params.participantName - Display name (not part of the opaque ID)
     * @param {string} params.socketId - (Optional) Socket ID for guest opaque ID mapping
     * @returns {Object} { token, url }
     */
    generateRealtimeToken: async ({ meetingId, userId, isHost, participantName, socketId }) => {
        const url = process.env.LIVEKIT_URL;
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;

        // If credentials are not configured, throw a clear error to be caught by the controller.
        if (!url || !apiKey || !apiSecret) {
            const error = new Error('LiveKit is not configured on this server.');
            error.statusCode = 501; // Not Implemented
            throw error;
        }

        // Room mapping: voom-{meetingId}
        // This ensures strict uniqueness and prevents cross-tenant collisions.
        const roomName = `voom-${meetingId.toString()}`;

        // Safe Participant Identity
        let participantIdentity;
        if (userId) {
            participantIdentity = `voom-user-${userId.toString()}`;
        } else {
            // For guests, use a safe opaque ID
            const randomBytes = crypto.randomBytes(8).toString('hex');
            const guestOpaqueId = socketId ? socketId : randomBytes;
            participantIdentity = `voom-guest-${guestOpaqueId}`;
        }

        // Generate the token
        const at = new AccessToken(apiKey, apiSecret, {
            identity: participantIdentity,
            name: participantName || "Guest",
        });

        // Set grants
        // Host has full permissions.
        // Members/Guests have permissions to join and publish, but not moderate.
        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            // Only hosts should potentially have roomAdmin, but Voom Socket.IO handles moderation,
            // so we don't grant LiveKit roomAdmin to keep application state in Voom.
            roomAdmin: false
        });

        const token = await at.toJwt();

        return { token, url };
    }
};
