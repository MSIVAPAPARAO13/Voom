import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteTrack, RemoteTrackPublication, Track, createLocalTracks } from 'livekit-client';
import { apiClient } from '../services/apiClient';

export default class LiveKitRealtimeProvider {
    constructor() {
        this.room = null;
        this.socketId = null;
        this.participantsCallback = null;
        this.participants = new Map(); // Map<socketId, stream>
        this.localStream = null;
    }

    /**
     * Connect to LiveKit Room
     * @param {Object} options
     * @param {Object} options.socket - The Socket.IO instance for application signaling (Chat/Presence)
     * @param {string} options.socketId - The current Socket.IO ID (used as fallback for identity)
     * @param {MediaStream} options.localStream - The local camera/mic stream
     */
    async connect({ socket, socketId, localStream }) {
        this.socketId = socketId;
        this.localStream = localStream;

        // 1. Fetch Realtime Token from Backend
        const meetingCode = window.location.pathname.split('/').pop();
        let realtimeData;
        try {
            const response = await apiClient.post(`/meetings/${meetingCode}/realtime-token`, { socketId });
            realtimeData = response.data;
        } catch (error) {
            console.error("Failed to fetch LiveKit token:", error);
            // Throw a clear error instead of falling back to P2P.
            throw new Error(error.response?.data?.message || "Failed to connect to media server.");
        }

        // 2. Initialize LiveKit Room
        this.room = new Room();

        // 3. Register Event Listeners
        this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            this._handleRemoteTrack(track, participant);
        });

        this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            this._handleParticipantLeft(participant);
        });

        this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
            this._handleParticipantLeft(participant);
        });

        // 4. Connect to Room
        await this.room.connect(realtimeData.url, realtimeData.token);
        console.log('Connected to LiveKit room:', this.room.name);

        // 5. Publish Local Tracks
        if (this.localStream) {
            await this.replaceLocalStream(this.localStream);
        }
    }

    onParticipantsUpdated(callback) {
        this.participantsCallback = callback;
    }

    _handleRemoteTrack(track, participant) {
        // Extract the socket ID (if it was used as the guest opaque ID) 
        // or just use the participant identity as a unique key for the UI.
        const id = participant.identity; 
        
        let existingStream = this.participants.get(id);

        if (!existingStream) {
            existingStream = new MediaStream();
            this.participants.set(id, existingStream);
        }

        existingStream.addTrack(track.mediaStreamTrack);

        this._triggerParticipantsUpdate();
    }

    _handleParticipantLeft(participant) {
        const id = participant.identity;
        this.participants.delete(id);
        this._triggerParticipantsUpdate();
    }

    _triggerParticipantsUpdate() {
        if (!this.participantsCallback) return;

        const videosList = Array.from(this.participants.entries()).map(([id, stream]) => ({
            socketId: id,
            stream: stream,
            autoplay: true,
            playsinline: true
        }));

        this.participantsCallback(videosList);
    }

    /**
     * Replaces the local camera/mic stream being published
     * @param {MediaStream} stream
     */
    async replaceLocalStream(stream) {
        if (!this.room) return;

        this.localStream = stream;

        // Unpublish existing tracks
        for (const pub of this.room.localParticipant.videoTrackPublications.values()) {
            await this.room.localParticipant.unpublishTrack(pub.track);
        }
        for (const pub of this.room.localParticipant.audioTrackPublications.values()) {
            await this.room.localParticipant.unpublishTrack(pub.track);
        }

        // Publish new tracks from the unified MediaStream
        for (const track of stream.getVideoTracks()) {
            if (track.enabled) {
                await this.room.localParticipant.publishTrack(track);
            }
        }

        for (const track of stream.getAudioTracks()) {
            if (track.enabled) {
                await this.room.localParticipant.publishTrack(track);
            }
        }
    }

    /**
     * Cleanly disconnect from LiveKit
     */
    disconnect() {
        if (this.room) {
            this.room.disconnect();
            this.room = null;
        }
        this.participants.clear();
        this.participantsCallback = null;
        this.localStream = null;
    }
}
