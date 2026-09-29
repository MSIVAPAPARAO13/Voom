# Voom — Meeting Engine & Architecture Audit

**Date:** September 2026  
**Audited Subsystems:** Meeting Engine, WebRTC Provider, Socket.IO Signaling Server, REST APIs, Persistence (MongoDB), BullMQ Worker, Meeting History, and Ask Voom RAG.

---

## 1. Current Meeting Lifecycle
* **Database States:** `Meeting.status` supports `scheduled`, `live`, `ended`.
* **State Machine Gap:** The backend lacks explicit intermediate states (`lobby`, `ending`, `cancelled`). When a host clicks "New Meeting", the meeting is immediately created as `live`.
* **Lobby Transition:** The frontend handles lobby via React state (`askForUsername = true`). Before clicking "Join Meeting", no socket connection is registered. The host and participants transition to `live` upon entering the call.
* **Termination:** Host can trigger `POST /api/v1/meetings/:meetingCode/end`, which marks status as `ended` and sets `endedAt`. However, Socket.IO clients were not uniformly disconnected or transitioned to an explicit `ended` screen with duration metrics.

---

## 2. Current WebRTC Lifecycle
* **Signaling Protocol:** Pure out-of-band signaling using Socket.IO `signal` and `user-joined` / `user-left` events.
* **Provider:** `P2PRealtimeProvider.js` manages an internal map of `RTCPeerConnection` instances (`connections[socketId]`).
* **Track Handling:**
  - Video and audio tracks are added via `peerConnection.addTrack(track, localStream)`.
  - On renegotiation / screen sharing, tracks were stopped abruptly via `window.localStream.getTracks().forEach(t => t.stop())`, killing the underlying camera device stream instead of safely replacing the track or maintaining a separate screen share track.
* **ICE Handling:** ICE candidates are gathered and emitted via `socket.emit("signal", targetId, { ice: candidate })`.
* **Cleanup:** When peers leave, connections are closed, but orphaned remote video tracks sometimes remained in `videoRef` array if React state was updated out-of-sync.

---

## 3. Current Socket.IO Lifecycle
* **Authentication:** Handshake middleware verifies JWT access token (`socket.user = decoded`). Unauthenticated users fall back to `guest`.
* **Room Management:** Sockets join based on `cleanPath` (e.g., `/meetingCode`).
* **In-Memory vs Redis:**
  - Standalone mode: Default memory adapter.
  - Multi-node: Optional Redis adapter.
* **Disconnect:** `socket.on("disconnect")` removes socket from `connections[path]` and notifies peers via `user-left`.

---

## 4. Current Meeting Persistence
* **Model:** `Meeting` schema (`meeting.model.js`).
* **Fields:** `organization`, `createdBy`, `user_id`, `meetingCode`, `title`, `description`, `status`, `settings` (`allowGuestAccess`, `waitingRoomEnabled`, `allowScreenShare`, `allowChat`, `allowParticipantUnmute`, `allowRecording`), `startedAt`, `endedAt`, `recordings`, `workspace`.
* **Durability:** Changes to settings and status are persisted in MongoDB.

---

## 5. Current Participant Persistence
* **Realtime State:** Ephemeral in `socketManager.js` (`participants[socketId] = { socketId, path, meetingCode, username, userId, isHost, isMuted, isVideoOff, isScreenSharing }`).
* **Historical Persistence:** `User.history` array stores meeting codes visited. Meeting document stores `createdBy`.

---

## 6. Current Chat Persistence
* **Realtime Channel:** Socket.IO `chat-message` and `meeting:chat-send`.
* **Database Collection:** `Message` collection (`message.model.js`).
* **Storage:** Messages are stored in MongoDB with `meeting`, `meetingCode`, `organization`, `sender`, `senderName`, `message`, `reactions`, `isEdited`, `isDeleted`.
* **Late-Join Sync:** On `join-call`, the server retrieves messages and emits them to the newly joined peer.

---

## 7. Current Recording Persistence
* **Lifecycle:** `startMeetingRecording` -> `stopMeetingRecording`.
* **States:** `recording`, `processing`, `ready`, `failed`.
* **Media:** MediaRecorder records WebM chunks in the browser and uploads to `POST /api/v1/meetings/:meetingCode/recordings/:recordingId/stop`.
* **Metadata:** Stored in `meeting.recordings` array.

---

## 8. Current Transcription Persistence
* **Queue:** BullMQ `transcription` queue (`transcription.worker.js`).
* **Model:** `Transcript` collection (`transcript.model.js`).
* **Status:** `queued`, `processing`, `completed`, `failed`.
* **Realtime Updates:** Emitted via PubSub and Socket.IO `meeting:transcription-status`.

---

## 9. Current History Implementation
* **Route:** `GET /api/v1/users/get_all_activity`.
* **Aggregator:** Fetches user's visited meeting codes and loads meeting metadata, workspace, chat log, and recordings.
* **UI:** Cards on `/history` with tabs for Overview, Notes, Chat Log, Recordings, Transcript, and AI Summary.

---

## 10. Current Ask Voom Implementation
* **Route:** `POST /api/v1/organizations/:id/ask`.
* **Service:** `askVoom.service.js` performs keyword/embedding search against indexed `Transcript` documents and generates summaries.
* **UI:** `/ask-voom` page. Previously showed generic error if no organization was selected or no transcripts were indexed.

---

## 11. Current Frontend State Management
* **`VideoMeet.jsx`**: Monolithic component handling WebRTC, media streams, Lobby UI, in-meeting drawer states, recording timers, and Socket listeners.
* **Child Components:** Modular components in `zfrontend/src/components/meeting/`:
  - `MeetingHeader.jsx`
  - `MeetingStage.jsx`
  - `MeetingControls.jsx`
  - `ChatPanel.jsx`
  - `ParticipantsPanel.jsx`
  - `MeetingSettingsDialog.jsx`
  - `FloatingSelfView.jsx`
  - `ParticipantFilmstrip.jsx`

---

## 12. Current API Inventory
1. `POST /api/v1/meetings` — Create meeting
2. `GET /api/v1/meetings/:code` — Get meeting metadata
3. `PATCH /api/v1/meetings/:code/settings` — Update meeting settings
4. `POST /api/v1/meetings/:code/end` — End meeting
5. `GET /api/v1/meetings/:code/workspace` — Get meeting workspace
6. `PATCH /api/v1/meetings/:code/notes` — Update notes
7. `GET /api/v1/meetings/:code/messages` — Fetch chat history
8. `POST /api/v1/meetings/:code/messages` — Send message
9. `POST /api/v1/meetings/:code/recordings/start` — Start recording
10. `POST /api/v1/meetings/:code/recordings/:id/stop` — Stop recording & upload
11. `GET /api/v1/meetings/:code/recordings/:id/transcription` — Check transcript
12. `POST /api/v1/organizations/:id/ask` — Ask Voom AI RAG

---

## 13. Current Socket.IO Event Inventory
* **Client -> Server:**
  - `join-call`
  - `signal`
  - `chat-message` / `meeting:chat-send`
  - `meeting:state-update` (mute, video toggle)
  - `meeting:typing-start` / `meeting:typing-stop`
  - `meeting:mute-participant`
  - `meeting:remove-participant`
  - `meeting:end`
* **Server -> Client:**
  - `user-joined`
  - `user-left`
  - `signal`
  - `chat-message` / `meeting:chat-message`
  - `meeting:participants-list`
  - `meeting:presence-update`
  - `meeting:recording-state`
  - `meeting:force-leave`
  - `meeting:ended`

---

## 14. Identified Bugs & Vulnerabilities
1. **Screen Share Track Collision:** Stopping camera tracks during screen share prevents switching back to webcam smoothly when screen share ends.
2. **Missing Screen Share Socket Broadcast:** Remote peers have no explicit `meeting:screen-share-started` / `meeting:screen-share-stopped` event to know who is presenting.
3. **Screen Share Race Condition:** No server check to prevent multiple simultaneous screen shares.
4. **Reconnection State Glitch:** If socket reconnects, local peer connections could become stale without clean renegotiation.
5. **Ask Voom Empty State:** Displayed generic "Not Found" error if no meeting transcripts were indexed.
6. **Chat Send on Disabled:** The frontend checked `allowChat`, but backend did not systematically broadcast a `meeting:chat-disabled` notification when host updates settings mid-call.

---

## 15. Action Plan for Refinements
1. **State Machine:** Formalize backend meeting status transitions (`scheduled` -> `live` -> `ended`).
2. **Server-Authoritative Screen Sharing:** Add `meeting:start-screen-share` and `meeting:stop-screen-share` with presenter lock.
3. **WebRTC Stream Preservation:** Separate camera track from display track so the presenter's camera PIP remains live during screen sharing.
4. **Active Speaker Detection:** Implement `AudioContext` volume analyzer for speaking halo/glow indicator.
5. **Ask Voom Polishing:** Replace 404s with rich empty states, indexed meeting counters, and suggested queries.
