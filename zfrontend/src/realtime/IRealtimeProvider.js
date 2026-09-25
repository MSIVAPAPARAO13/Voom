/**
 * IRealtimeProvider.js
 * 
 * Defines the contract for Realtime Media Providers (P2P and LiveKit).
 */
export default class IRealtimeProvider {
    /**
     * Connect to the realtime session.
     * @param {Object} options - Provider-specific options
     */
    async connect(options) {
        throw new Error("Not implemented");
    }

    /**
     * Disconnect and cleanup.
     */
    disconnect() {
        throw new Error("Not implemented");
    }

    /**
     * Toggle local camera.
     * @param {boolean} active 
     */
    async setVideoEnabled(active) {
        throw new Error("Not implemented");
    }

    /**
     * Toggle local microphone.
     * @param {boolean} active 
     */
    async setAudioEnabled(active) {
        throw new Error("Not implemented");
    }

    /**
     * Start/stop screen sharing.
     * @param {boolean} active 
     */
    async setScreenShareEnabled(active) {
        throw new Error("Not implemented");
    }

    /**
     * Replaces the local stream (e.g. after changing from camera to screen share)
     * @param {MediaStream} newStream 
     */
    async replaceLocalStream(newStream) {
        throw new Error("Not implemented");
    }

    // Callbacks to bind UI
    onParticipantsUpdated(callback) { this._onParticipantsUpdated = callback; }
}
